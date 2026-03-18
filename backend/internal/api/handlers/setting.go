package handlers

import (
	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// GetScannerConfig - GET /api/v1/settings/scanner-rules
func GetScannerConfig(c *fiber.Ctx) error {
	var config models.SystemSetting

	// We use FirstOrCreate. If the table is empty (first boot), it creates ID 1 with the default values.
	if err := db.DB.Where("id = ?", 1).FirstOrCreate(&config, models.SystemSetting{
		ID:                   1,
		MaxConcurrentWorkers: 20,
		TimeoutSeconds:       15,
		EnableCertSpotter:    true,
		EnableHackerTarget:   true,
		EnableAlienVault:     true,
	}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch system settings"})
	}

	return c.JSON(config)
}

// UpdateScannerConfig - PUT /api/v1/settings/scanner-rules
func UpdateScannerConfig(c *fiber.Ctx) error {
	type UpdateRequest struct {
		MaxConcurrentWorkers int  `json:"max_concurrent_workers"`
		TimeoutSeconds       int  `json:"timeout_seconds"`
		EnableCertSpotter    bool `json:"enable_cert_spotter"`
		EnableHackerTarget   bool `json:"enable_hacker_target"`
		EnableAlienVault     bool `json:"enable_alien_vault"`
	}

	var req UpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON payload"})
	}

	// Fetch the existing config (ID = 1)
	var config models.SystemSetting
	if err := db.DB.First(&config, 1).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Settings record not found. Please GET /scanner-rules first to initialize."})
	}

	// Update the values
	// We add some safety rails so users can't crash the server by requesting 1,000,000 goroutines
	if req.MaxConcurrentWorkers > 0 && req.MaxConcurrentWorkers <= 200 {
		config.MaxConcurrentWorkers = req.MaxConcurrentWorkers
	}
	if req.TimeoutSeconds >= 5 && req.TimeoutSeconds <= 60 {
		config.TimeoutSeconds = req.TimeoutSeconds
	}
	
	config.EnableCertSpotter = req.EnableCertSpotter
	config.EnableHackerTarget = req.EnableHackerTarget
	config.EnableAlienVault = req.EnableAlienVault

	// Save changes back to Postgres
	if err := db.DB.Save(&config).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update settings"})
	}

	return c.JSON(fiber.Map{
		"message": "Scanner engine configuration updated successfully",
		"config":  config,
	})
}