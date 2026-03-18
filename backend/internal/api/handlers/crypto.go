package handlers

import (
	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// ListAllCerts - GET /api/v1/crypto/certificates
// Returns the master list of all discovered TLS/SSL certificates and their PQC tiers.
func ListAllCerts(c *fiber.Ctx) error {
	var certs []models.SSLCertificate

	// Preload the Subdomain so the React UI knows exactly which URL this certificate belongs to
	if err := db.DB.Preload("Subdomain").Order("created_at desc").Find(&certs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch certificates"})
	}

	return c.JSON(fiber.Map{
		"count":        len(certs),
		"certificates": certs,
	})
}

// ListLegacyCrypto - GET /api/v1/crypto/vulnerabilities
// The "Red Alert" endpoint. Pulls highly vulnerable assets (TLS 1.0, TLS 1.1, or Legacy PQC Tiers).
func ListLegacyCrypto(c *fiber.Ctx) error {
	var certs []models.SSLCertificate

	// Filter for weak protocol versions OR our designated 'Legacy' PQC tier
	if err := db.DB.Where("tls_version IN ? OR pqc_tier = ?", []string{"TLS 1.0", "TLS 1.1"}, "Legacy").
		Preload("Subdomain").
		Order("tls_version asc").
		Find(&certs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch crypto vulnerabilities"})
	}

	return c.JSON(fiber.Map{
		"severity": "High",
		"count":    len(certs),
		"assets":   certs,
	})
}

// ListEliteCrypto - GET /api/v1/crypto/quantum-ready
// The "Green Checkmark" endpoint. Highlights assets successfully negotiating ML-KEM/Kyber.
func ListEliteCrypto(c *fiber.Ctx) error {
	var certs []models.SSLCertificate

	// Filter for assets that have achieved the 'Elite' (Quantum-Safe) tier
	if err := db.DB.Where("pqc_tier = ?", "Elite").
		Preload("Subdomain").
		Find(&certs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch quantum-ready assets"})
	}

	return c.JSON(fiber.Map{
		"compliance": "NIST FIPS 203/204",
		"count":      len(certs),
		"assets":     certs,
	})
}