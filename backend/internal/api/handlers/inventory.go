// backend/internal/api/handlers/inventory.go
package handlers

import (
	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// ListAllAssets - GET /api/v1/inventory/
// Fetches the master list of all discovered subdomains, preloading their open ports and TLS certs.
func ListAllAssets(c *fiber.Ctx) error {
	var subdomains []models.Subdomain

	// We only want to show assets that actually resolved to an IP (is_alive = true)
	// Preload automatically joins the relational tables so React gets one massive, clean JSON array.
	if err := db.DB.Where("is_alive = ?", true).
		Preload("Services").
		Preload("SSLCert").
		Order("hostname asc").
		Find(&subdomains).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch asset inventory"})
	}

	return c.JSON(fiber.Map{
		"count":  len(subdomains),
		"assets": subdomains,
	})
}

// GetAssetDetail - GET /api/v1/inventory/:subdomainId
// Deep dive into a single endpoint (useful for a slide-out panel in the React UI)
func GetAssetDetail(c *fiber.Ctx) error {
	subdomainID := c.Params("subdomainId")
	var subdomain models.Subdomain

	if err := db.DB.Preload("Services").Preload("SSLCert").First(&subdomain, subdomainID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Asset not found"})
	}

	return c.JSON(subdomain)
}

// FilterByPort - GET /api/v1/inventory/filter/ports?port=8443
// Allows the judges to ask: "Show me everything running on an obscure port"
func FilterByPort(c *fiber.Ctx) error {
	portQuery := c.Query("port")
	if portQuery == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Port query parameter is required (e.g., ?port=443)"})
	}

	var services []models.Service
	// Query the Services table, but pull the parent Subdomain data with it
	if err := db.DB.Where("port = ?", portQuery).Preload("Subdomain").Find(&services).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database query failed"})
	}

	return c.JSON(fiber.Map{
		"port":    portQuery,
		"count":   len(services),
		"results": services,
	})
}

// FilterByTech - GET /api/v1/inventory/filter/tech?name=nginx
// Allows filtering by web server technology extracted from HTTP headers
func FilterByTech(c *fiber.Ctx) error {
	techQuery := c.Query("name")
	if techQuery == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Tech query parameter is required (e.g., ?name=nginx)"})
	}

	var services []models.Service
	// Use ILIKE (PostgreSQL) for case-insensitive partial matching
	if err := db.DB.Where("web_tech ILIKE ?", "%"+techQuery+"%").Preload("Subdomain").Find(&services).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database query failed"})
	}

	return c.JSON(fiber.Map{
		"tech":    techQuery,
		"count":   len(services),
		"results": services,
	})
}