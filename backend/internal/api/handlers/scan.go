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

// ActiveScans holds the cancellation functions for running pipelines
var ActiveScans sync.Map

type ScanRequest struct {
	Domain string `json:"domain"`
}

// StartPipeline initiates the background worker
func StartPipeline(c *fiber.Ctx) error {
	var req ScanRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid payload"})
	}

	var existing models.Domain
	db.DB.Where("domain_name = ? AND status = ?", req.Domain, "scanning").First(&existing)
	if existing.ID != 0 {
		return c.Status(409).JSON(fiber.Map{"error": "Scan already in progress"})
	}

	// 1. Create or Reset the Domain Record
	var domain models.Domain
	db.DB.Where("domain_name = ?", req.Domain).FirstOrCreate(&domain, models.Domain{DomainName: req.Domain})

	// Reset progress counters
	db.DB.Model(&domain).Updates(map[string]interface{}{
		"status":         "pending",
		"total_assets":   0,
		"scanned_assets": 0,
	})

	// 2. Create a Cancellable Context
	ctx, cancel := context.WithCancel(context.Background())
	ActiveScans.Store(domain.ID, cancel)

	// 3. Fire the worker, passing the Context
	go scanner.RunEnterprisePipeline(ctx, domain.ID, domain.DomainName)

	return c.Status(202).JSON(fiber.Map{
		"message":   "Pipeline started",
		"domain_id": domain.ID,
	})
}

// StopPipeline acts as an emergency halt
func StopPipeline(c *fiber.Ctx) error {
	domainID := c.Params("domainId")

	// 1. Fetch the domain
	var domain models.Domain
	if err := db.DB.First(&domain, domainID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
	}

	// 2. Look for the active context and trigger cancellation
	if cancelFunc, exists := ActiveScans.Load(domain.ID); exists {
		cancelFunc.(context.CancelFunc)() // Fires the halt signal
		ActiveScans.Delete(domain.ID)

		db.DB.Model(&domain).Update("status", "halted")
		return c.JSON(fiber.Map{"message": "Pipeline halted successfully"})
	}

	return c.Status(400).JSON(fiber.Map{"error": "No active scan found for this domain"})
}

// GetScanProgress calculates real-time completion percentage
func GetScanProgress(c *fiber.Ctx) error {
	domainID := c.Params("domainId")

	var domain models.Domain
	if err := db.DB.First(&domain, domainID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
	}

	// Calculate percentage
	percentage := 0.0
	if domain.TotalAssets > 0 {
		percentage = (float64(domain.ScannedAssets) / float64(domain.TotalAssets)) * 100
	}

	// If discovery hasn't finished yet but scan is running
	if domain.Status == "scanning" && domain.TotalAssets == 0 {
		percentage = 5.0 // Fake 5% while crt.sh does discovery
	}
	if domain.Status == "completed" {
		percentage = 100.0
	}

	return c.JSON(fiber.Map{
		"domain_id":      domain.ID,
		"status":         domain.Status,
		"total_assets":   domain.TotalAssets,
		"scanned_assets": domain.ScannedAssets,
		"percentage":     fmt.Sprintf("%.2f", percentage),
	})
}
