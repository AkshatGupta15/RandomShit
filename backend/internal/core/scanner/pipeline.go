package scanner

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"

	"gorm.io/gorm"
)

// RunEnterprisePipeline now accepts a context for cancellation
func RunEnterprisePipeline(ctx context.Context, domainID uint, rootDomain string) {
	fmt.Printf("[⚙️] PIPELINE INITIATED: %s\n", rootDomain)
	db.DB.Model(&models.Domain{}).Where("id = ?", domainID).Update("status", "scanning")

	// Hard-delete old assets for this domain before we scan again
	// Because of our GORM Cascade setup, this safely wipes old Services and SSLCerts too.
	db.DB.Unscoped().Where("domain_id = ?", domainID).Delete(&models.Subdomain{})
	// 1. Discovery Phase
	subdomains := DiscoverSubdomains(rootDomain)
	totalFound := len(subdomains)

	db.DB.Model(&models.Domain{}).Where("id = ?", domainID).Update("total_assets", totalFound)

	// 2. Concurrency Control
	var wg sync.WaitGroup
	// Fetch the live config at the exact moment the scan starts
	var config models.SystemSetting
	db.DB.First(&config, 1)

	// Use the dynamic value instead of the hardcoded 20!
	workerLimit := config.MaxConcurrentWorkers
	if workerLimit == 0 {
		workerLimit = 20
	} // Fallback safety

	semaphore := make(chan struct{}, workerLimit)

	for _, sub := range subdomains {
		// THE KILL SWITCH: Check if the admin clicked "Stop" before launching next worker
		select {
		case <-ctx.Done():
			fmt.Printf("[!] PIPELINE HALTED BY ADMIN: %s\n", rootDomain)
			return // Exits the entire pipeline loop safely
		default:
			// Proceed with scan
		}

		wg.Add(1)
		semaphore <- struct{}{}

		go func(hostname string) {
			defer wg.Done()
			defer func() { <-semaphore }()

			// 1. Resolve IP to check if it's alive
			ip := ResolveIP(hostname)
			isAlive := (ip != "")

			// 2. SAVE EVERY SUBDOMAIN TO THE DB (Alive or Dead)
			newSub := models.Subdomain{
				DomainID:  domainID,
				Hostname:  hostname,
				IPAddress: ip,      // Will just be "" if dead
				IsAlive:   isAlive, // True if alive, False if dead/dangling
			}
			db.DB.Create(&newSub)

			// 3. ONLY run Port and Crypto scans if the asset is actually alive
			if isAlive {
				// TARGET PORTS: The Top Enterprise Attack Surface Ports
				targetPorts := []int{21, 22, 80, 443, 3306, 3389, 5432, 8080, 8443, 9000, 9443}

				for _, port := range targetPorts {
					if ScanPort(ip, port) {

						// HTTP Fingerprinting
						httpInfo := ProbeHTTP(hostname, port)
						if httpInfo != nil {
							db.DB.Create(&models.Service{
								SubdomainID: newSub.ID,
								Port:        port,
								Protocol:    "tcp",
								WebTech:     httpInfo.Server,
								StatusCode:  httpInfo.StatusCode,
								PageTitle:   httpInfo.Title,
							})
						}

						// PQC & TLS Cryptography Extraction (Ports 443 & 8443)
						if port == 443 || port == 8443 {
							certData := ProbeTLS(hostname, ip)
							if certData != nil {
								certData.SubdomainID = newSub.ID
								db.DB.Create(certData)
							}
						}
					}
				}
			}

			// 4. Increment the progress bar for the React UI
			db.DB.Model(&models.Domain{}).Where("id = ?", domainID).UpdateColumn("scanned_assets", gorm.Expr("scanned_assets + ?", 1))

		}(sub)
	}

	wg.Wait()

	// If we got here, it wasn't cancelled
	db.DB.Model(&models.Domain{}).Where("id = ?", domainID).Updates(map[string]interface{}{
		"status":         "completed",
		"last_scanned":   time.Now(),
		"scanned_assets": totalFound, // Ensure it locks to 100%
	})
	fmt.Printf("[✅] PIPELINE COMPLETED: %s\n", rootDomain)
}
