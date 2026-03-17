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

	// 1. Discovery Phase
	subdomains := DiscoverSubdomains(rootDomain)
	totalFound := len(subdomains)

	db.DB.Model(&models.Domain{}).Where("id = ?", domainID).Update("total_assets", totalFound)

	// 2. Concurrency Control
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 20)

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

			// Resolve IP
			ip := ResolveIP(hostname)
			if ip != "" {
				newSub := models.Subdomain{
					DomainID:  domainID,
					Hostname:  hostname,
					IPAddress: ip,
					IsAlive:   true,
				}
				db.DB.Create(&newSub)

				// Scan Ports & Extract HTTP/TLS (Using your existing engines.go functions)
				if ScanPort(ip, 443) {
					certData := ProbeTLS(hostname, ip)
					if certData != nil {
						certData.SubdomainID = newSub.ID
						db.DB.Create(certData)
					}
				}
			}

			// INCREMENT PROGRESS TRACKER (Atomic equivalent via GORM)
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
