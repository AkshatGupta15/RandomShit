package handlers

import (
	"context"
	"fmt"
	"sync"

	"github.com/AkshatGupta15/RandomShit/backend/internal/core/scanner"
	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ActiveScans acts as an in-memory registry for our kill switches
var ActiveScans sync.Map

type ScanRequest struct {
	Domain string `json:"domain"`
}

// StartPipeline - POST /api/v1/scan/start
func StartPipeline(c *fiber.Ctx) error {
	var req ScanRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON payload"})
	}

	if req.Domain == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Domain is required"})
	}

	// 1. Check if it's already running to prevent duplicate background workers
	var existing models.Domain
	db.DB.Where("domain_name = ? AND status = ?", req.Domain, "scanning").First(&existing)
	if existing.ID != 0 {
		return c.Status(409).JSON(fiber.Map{"error": "Scan is already in progress for this domain"})
	}

	// 2. Fetch or create the Domain in the database
	var domain models.Domain
	db.DB.Where("domain_name = ?", req.Domain).FirstOrCreate(&domain, models.Domain{
		DomainName: req.Domain,
	})

	// 3. Reset progress trackers for a fresh scan
	db.DB.Model(&domain).Updates(map[string]interface{}{
		"status":         "scanning",
		"total_assets":   0,
		"scanned_assets": 0,
	})

	// 4. Create the Kill Switch (Cancellable Context)
	ctx, cancel := context.WithCancel(context.Background())
	ActiveScans.Store(domain.ID, cancel)

	// 5. Fire the background pipeline
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
