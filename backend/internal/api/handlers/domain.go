// backend/internal/api/handlers/domain.go
package handlers

import (
	"context"
	"strings"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// AddDomainRequest defines the JSON payload expected from React
type AddDomainRequest struct {
	Domain string `json:"domain"`
}

// ListRootDomains - GET /api/v1/domains/
// Returns all tracked enterprise targets and their scan status
func ListRootDomains(c *fiber.Ctx) error {
	var domains []models.Domain

	// Fetch all domains, ordered by the newest added first
	if err := db.DB.Order("created_at desc").Find(&domains).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch domains from database"})
	}

	return c.JSON(fiber.Map{
		"count":   len(domains),
		"domains": domains,
	})
}

// AddRootDomain - POST /api/v1/domains/
// Allows the admin to manually add a new target without starting a scan immediately
func AddRootDomain(c *fiber.Ctx) error {
	var req AddDomainRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON payload"})
	}

	// Clean up the input (remove spaces, make lowercase, strip https:// if they pasted a URL)
	cleanDomain := strings.TrimSpace(strings.ToLower(req.Domain))
	cleanDomain = strings.TrimPrefix(cleanDomain, "https://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "http://")

	if cleanDomain == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Domain name cannot be empty"})
	}

	// Check if the domain is already in the database
	var existing models.Domain
	db.DB.Where("domain_name = ?", cleanDomain).First(&existing)
	if existing.ID != 0 {
		return c.Status(409).JSON(fiber.Map{"error": "Domain is already being tracked"})
	}

	// Save to database with 'pending' status
	newDomain := models.Domain{
		DomainName: cleanDomain,
		Status:     "pending",
	}

	if err := db.DB.Create(&newDomain).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save domain to database"})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "Domain added successfully",
		"domain":  newDomain,
	})
}

// RemoveRootDomain - DELETE /api/v1/domains/:id
// Completely wipes the domain and all its discovered assets from the database
func RemoveRootDomain(c *fiber.Ctx) error {
	domainID := c.Params("id")

	// Find the domain first to ensure it exists
	var domain models.Domain
	if err := db.DB.First(&domain, domainID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
	}

	// Stop any active scans for this domain before deleting
	if cancelFunc, exists := ActiveScans.Load(domain.ID); exists {
		cancelFunc.(context.CancelFunc)()
		ActiveScans.Delete(domain.ID)
	}
	// Use Unscoped() to permanently delete from the database (Hard Delete)
	// Because of our GORM Cascade constraints, this instantly deletes all subdomains/certs too.
	if err := db.DB.Unscoped().Delete(&domain).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete domain data"})
	}

	return c.JSON(fiber.Map{
		"message":   "Domain and all associated asset data permanently deleted",
		"domain_id": domainID,
	})
}
