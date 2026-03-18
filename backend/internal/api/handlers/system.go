package handlers

import (
	"runtime"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// Track when the server started for uptime calculation
var startTime = time.Now()

// HealthCheck - GET /api/v1/system/health
// Basic ping to ensure the API and Database are alive
func HealthCheck(c *fiber.Ctx) error {
	dbStatus := "Connected"

	// Ping the underlying SQL database
	sqlDB, err := db.DB.DB()
	if err != nil || sqlDB.Ping() != nil {
		dbStatus = "Disconnected (Critical)"
		return c.Status(503).JSON(fiber.Map{
			"status":   "degraded",
			"database": dbStatus,
		})
	}

	return c.JSON(fiber.Map{
		"status":    "operational",
		"uptime":    time.Since(startTime).String(),
		"database":  dbStatus,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// ScannerEngineStatus - GET /api/v1/system/engine-status
// The Ultimate Hackathon Flex: Live Go Runtime Telemetry
func ScannerEngineStatus(c *fiber.Ctx) error {
	// 1. Grab Go memory and OS thread stats
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// 2. Fetch active scanner configuration
	var config models.SystemSetting
	db.DB.First(&config, 1)

	// 3. Count how many enterprise domains are currently being scanned
	var activeScans int64
	db.DB.Model(&models.Domain{}).Where("status = ?", "scanning").Count(&activeScans)

	return c.JSON(fiber.Map{
		"engine_architecture": "Golang Native M:N Scheduler",
		"active_scans":        activeScans,

		// The Flex: Show off Go's extreme concurrency and low memory footprint
		"telemetry": fiber.Map{
			"active_goroutines":   runtime.NumGoroutine(),
			"memory_allocated_mb": m.Alloc / 1024 / 1024, // Convert bytes to MB
			"sys_memory_mb":       m.Sys / 1024 / 1024,
		},

		"capacity": fiber.Map{
			"max_worker_threads": config.MaxConcurrentWorkers,
			"http_timeout_sec":   config.TimeoutSeconds,
		},

		"osint_modules": fiber.Map{
			"certspotter":  config.EnableCertSpotter,
			"hackertarget": config.EnableHackerTarget,
			"alienvault":   config.EnableAlienVault,
		},
	})
}
