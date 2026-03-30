package scanner

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"gorm.io/gorm"
)

// RunEnterprisePipeline executes OSINT discovery and PQC scanning
func RunEnterprisePipeline(ctx context.Context, domainID uint, rootDomain string) {
	fmt.Printf("[⚙️] PIPELINE INITIATED: %s\n", rootDomain)
	db.DB.Model(&models.Domain{}).Where("id = ?", domainID).Update("status", "scanning")

	// Hard-delete old assets for this domain before we scan again
	db.DB.Unscoped().Where("domain_id = ?", domainID).Delete(&models.Subdomain{})

	// 1. Discovery Phase
	subdomains := DiscoverSubdomains(rootDomain)
	totalFound := len(subdomains)
	if totalFound == 0 {
		db.DB.Model(&models.Domain{}).Where("id = ?", domainID).Updates(map[string]interface{}{
			"status":         "completed",
			"last_scanned":   time.Now(),
			"scanned_assets": 0,
			"total_assets":   0,
		})
		fmt.Printf("[✅] PIPELINE COMPLETED (NO SUBDOMAINS): %s\n", rootDomain)
		return
	}

	db.DB.Model(&models.Domain{}).Where("id = ?", domainID).Update("total_assets", totalFound)

	// 2. Concurrency Control
	var wg sync.WaitGroup
	workerLimit := 20 // Adjust based on your server capacity

	semaphore := make(chan struct{}, workerLimit)
	var totalLiveAssets int64 = 0

	for _, sub := range subdomains {
		select {
		case <-ctx.Done():
			fmt.Printf("[!] PIPELINE HALTED BY ADMIN: %s\n", rootDomain)
			return
		default:
		}

		wg.Add(1)
		semaphore <- struct{}{}

		go func(hostname string) {
			defer wg.Done()
			defer func() { <-semaphore }()

			subRecord := models.Subdomain{
				DomainID:   domainID,
				Hostname:   hostname,
				IsAlive:    false,
				ScanStatus: "scanning",
			}

			db.DB.Where("domain_id = ? AND hostname = ?", domainID, hostname).
				Assign(models.Subdomain{ScanStatus: "scanning"}).
				FirstOrCreate(&subRecord)

			// 1. Resolve IP
			ip := ResolveIP(hostname)
			if ip == "" {
				db.DB.Model(&subRecord).Updates(map[string]interface{}{
					"scan_status": "completed",
					"is_alive":    false,
				})
				db.DB.Model(&models.Domain{}).Where("id = ?", domainID).UpdateColumn("scanned_assets", gorm.Expr("scanned_assets + ?", 1))
				return
			}
			atomic.AddInt64(&totalLiveAssets, 1)

			// 2. Update resolved live subdomain
			db.DB.Model(&subRecord).Updates(map[string]interface{}{
				"ip_address": ip,
				"is_alive":   true,
			})

			// 3. Port scanning and Web/TLS probing
			targetPorts := []int{80, 443, 8080, 8443}
			for _, port := range targetPorts {
				if ScanPort(ip, port) {
					httpInfo := ProbeHTTP(hostname, port)
					if httpInfo != nil {
						db.DB.Create(&models.Service{
							SubdomainID: subRecord.ID,
							Port:        port,
							Protocol:    "tcp",
							WebTech:     httpInfo.Server,
							StatusCode:  httpInfo.StatusCode,
							PageTitle:   httpInfo.Title,
						})
					}

					// 🟢 THE PQC INJECTION 🟢
					if port == 443 || port == 8443 {
						report := PerformDeepTLSScan(hostname, ip)
						if report.DetectedAlgorithm != "OFFLINE" {

							riskLabel := "CRITICAL"
							if report.SecurityScore >= 80 {
								riskLabel = "Quantum Safe"
							} else if report.SecurityScore >= 50 {
								riskLabel = "HNDL Risk"
							}

							certData := &models.SSLCertificate{
								SubdomainID: subRecord.ID,
								Issuer:      report.CertIssuer,
								ValidFrom:   time.Now(),
								ValidTo:     report.ValidTo,
								TLSVersion:  report.TLSVersion,
								CipherSuite: report.CipherSuite,
								KeyLength:   report.DetectedAlgorithm,
								PQCTier:     riskLabel,
								QScore:      report.SecurityScore,
								RiskLabel:   riskLabel,
							}
							db.DB.Create(certData)
						}
					}
				}
			}

			db.DB.Model(&subRecord).Update("scan_status", "completed")

			// Increment progress for each fully processed hostname
			db.DB.Model(&models.Domain{}).Where("id = ?", domainID).UpdateColumn("scanned_assets", gorm.Expr("scanned_assets + ?", 1))
		}(sub)
	}

	wg.Wait()

	db.DB.Model(&models.Domain{}).Where("id = ?", domainID).Updates(map[string]interface{}{
		"status":         "completed",
		"last_scanned":   time.Now(),
		"scanned_assets": totalFound,
		"total_assets":   totalFound,
		"endpoints":      totalLiveAssets,
	})
	fmt.Printf("[✅] PIPELINE COMPLETED: %s\n", rootDomain)
}
