package scanner

import (
	"sync"
	"time"

	database "github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
)

// RunAsyncPQCScan re-scans known subdomains from the database
func RunAsyncPQCScan(domainID uint, baseHostname string) {
	database.DB.Model(&models.Domain{}).Where("id = ?", domainID).Update("status", "scanning")

	var subdomains []models.Subdomain
	database.DB.Where("domain_id = ?", domainID).Find(&subdomains)

	var wg sync.WaitGroup
	sem := make(chan struct{}, 20)

	for _, sub := range subdomains {
		wg.Add(1)
		go func(s models.Subdomain) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			database.DB.Model(&s).Update("scan_status", "scanning")

			// 🟢 Call the pure scanner
			report := PerformDeepTLSScan(s.Hostname, s.IPAddress)

			if report.DetectedAlgorithm != "OFFLINE" {
				riskLabel := "CRITICAL"
				if report.SecurityScore >= 80 {
					riskLabel = "Quantum Safe"
				} else if report.SecurityScore >= 50 {
					riskLabel = "HNDL Risk"
				}

				cert := models.SSLCertificate{
					SubdomainID: s.ID,
					Issuer:      report.CertIssuer,
					TLSVersion:  report.TLSVersion,
					CipherSuite: report.CipherSuite,
					KeyLength:   report.DetectedAlgorithm,
					QScore:      report.SecurityScore,
					PQCTier:     riskLabel,
					RiskLabel:   riskLabel,
					ValidTo:     report.ValidTo,
				}

				database.DB.Where("subdomain_id = ?", s.ID).Assign(cert).FirstOrCreate(&cert)
				database.DB.Model(&s).Update("is_alive", true)
			}

			database.DB.Model(&s).Update("scan_status", "completed")
		}(sub)
	}

	wg.Wait()

	database.DB.Model(&models.Domain{}).Where("id = ?", domainID).Updates(map[string]interface{}{
		"status":         "completed",
		"last_scanned":   time.Now(),
		"scanned_assets": len(subdomains),
	})
}
