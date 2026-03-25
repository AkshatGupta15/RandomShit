package handlers

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/core/scanner"
	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ActiveScans acts as an in-memory registry for our kill switches
var ActiveScans sync.Map

type ScanRequest struct {
	DomainID uint `json:"domain_id"`
}

// StartPipeline - POST /api/v1/scan/start
func StartPipeline(c *fiber.Ctx) error {
	var req ScanRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON payload"})
	}

	if req.DomainID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "domain_id is required"})
	}

	var domain models.Domain
	// Fetch domain by ID
	if err := db.DB.First(&domain, req.DomainID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
	}

	// 1. Check if it's already running to prevent duplicate background workers
	if domain.Status == "scanning" {
		return c.Status(409).JSON(fiber.Map{
			"error": "Scan is already in progress for this domain",
		})
	}

	// 2. Reset progress trackers for a fresh scan
	db.DB.Model(&domain).Updates(map[string]interface{}{
		"status":         "scanning",
		"total_assets":   0,
		"scanned_assets": 0,
	})

	// 3. Create the Kill Switch (Cancellable Context)
	ctx, cancel := context.WithCancel(context.Background())
	ActiveScans.Store(domain.ID, cancel)

	// 4. Fire the background pipeline
	// Notice we pass the 'ctx' so the pipeline knows when to stop
	go scanner.RunEnterprisePipeline(ctx, domain.ID, domain.DomainName)

	return c.Status(202).JSON(fiber.Map{
		"message":   "Pipeline initiated successfully in the background",
		"domain_id": domain.ID,
		"status":    "scanning",
	})
}

// StopPipeline - POST /api/v1/scan/stop/:domainId
func StopPipeline(c *fiber.Ctx) error {
	domainID := c.Params("domainId")

	// 1. Verify the domain exists
	var domain models.Domain
	if err := db.DB.First(&domain, domainID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Domain not found in database"})
	}

	// 2. Look for the active kill switch in our sync.Map
	cancelFunc, exists := ActiveScans.Load(domain.ID)
	if !exists {
		return c.Status(400).JSON(fiber.Map{"error": "No active scan found for this domain to halt"})
	}

	// 3. Pull the trigger to terminate the goroutine
	cancelFunc.(context.CancelFunc)()
	ActiveScans.Delete(domain.ID)

	// 4. Update the database to reflect the halt
	db.DB.Model(&domain).Update("status", "halted")

	return c.JSON(fiber.Map{
		"message": "Pipeline halted successfully. Background worker terminated.",
		"status":  "halted",
	})
}

// GetScanProgress - GET /api/v1/scan/status/:domainId
func GetScanProgress(c *fiber.Ctx) error {
	domainID := c.Params("domainId")

	var domain models.Domain
	if err := db.DB.First(&domain, domainID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
	}

	// Calculate the exact percentage safely
	percentage := 0.0
	if domain.TotalAssets > 0 {
		percentage = (float64(domain.ScannedAssets) / float64(domain.TotalAssets)) * 100
	} else if domain.Status == "scanning" {
		// If it's scanning but total_assets is 0, we are still in the DNS discovery phase
		percentage = 5.0
	} else if domain.Status == "completed" {
		percentage = 100.0
	}

	return c.JSON(fiber.Map{
		"domain_id":      domain.ID,
		"domain_name":    domain.DomainName,
		"status":         domain.Status,
		"total_assets":   domain.TotalAssets,
		"scanned_assets": domain.ScannedAssets,
		"percentage":     fmt.Sprintf("%.2f", percentage),
	})
}

// GetDiscoveryFeed - GET /api/v1/scan/discovery-feed
func GetDiscoveryFeed(c *fiber.Ctx) error {
	domainID := c.QueryInt("domain_id", 0)
	limit := c.QueryInt("limit", 20)
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	query := db.DB.Model(&models.Subdomain{}).
		Where("is_alive = ?", true).
		Preload("SSLCert").
		Preload("Services").
		Order("created_at desc").
		Limit(limit)

	if domainID > 0 {
		query = query.Where("domain_id = ?", domainID)
	}

	var subdomains []models.Subdomain
	if err := query.Find(&subdomains).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch discovery feed"})
	}

	data := make([]fiber.Map, 0, len(subdomains))
	for _, sub := range subdomains {
		assetType := "domain"
		if sub.IPAddress != "" {
			assetType = "ip"
		}
		if len(sub.Services) > 0 {
			assetType = "software"
		}
		if sub.SSLCert != nil {
			assetType = "ssl"
		}

		status := "standard"
		if sub.SSLCert != nil {
			tier := strings.ToLower(strings.TrimSpace(sub.SSLCert.PQCTier))
			switch tier {
			case "elite":
				status = "elite"
			case "legacy":
				status = "legacy"
			default:
				status = "standard"
			}

			risk := strings.ToLower(strings.TrimSpace(sub.SSLCert.RiskLabel))
			if strings.Contains(risk, "critical") || strings.Contains(risk, "high") {
				status = "critical"
			}
		}

		timestamp := sub.CreatedAt
		if !sub.UpdatedAt.IsZero() && sub.UpdatedAt.After(timestamp) {
			timestamp = sub.UpdatedAt
		}
		if timestamp.IsZero() {
			timestamp = time.Now()
		}

		data = append(data, fiber.Map{
			"id":        sub.ID,
			"name":      sub.Hostname,
			"type":      assetType,
			"status":    status,
			"timestamp": timestamp,
		})
	}

	return c.JSON(fiber.Map{
		"count": len(data),
		"data":  data,
	})
}
