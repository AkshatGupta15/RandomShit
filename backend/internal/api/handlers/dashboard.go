package handlers

import (
	"quantum-scanner/internal/db"
	"quantum-scanner/internal/models"
	"time"

	"github.com/gofiber/fiber/v2"
)

// GetDashboardMetrics calculates live stats for the React UI
func GetDashboardMetrics(c *fiber.Ctx) error {
	var totalDomains, totalSubdomains, eliteAssets, highRiskAssets, expiringCerts int64

	db.DB.Model(&models.Domain{}).Count(&totalDomains)
	db.DB.Model(&models.Subdomain{}).Where("is_alive = ?", true).Count(&totalSubdomains)

	// Crypto Tiering Counts
	db.DB.Model(&models.SSLCertificate{}).Where("pqc_tier = ?", "Elite").Count(&eliteAssets)
	db.DB.Model(&models.SSLCertificate{}).Where("pqc_tier = ?", "Legacy").Count(&highRiskAssets)

	// Expiring within 30 days
	thirtyDaysFromNow := time.Now().AddDate(0, 0, 30)
	db.DB.Model(&models.SSLCertificate{}).Where("valid_to < ?", thirtyDaysFromNow).Count(&expiringCerts)

	return c.JSON(fiber.Map{
		"kpis": fiber.Map{
			"totalDomains":   totalDomains,
			"liveEndpoints":  totalSubdomains,
			"elitePqcReady":  eliteAssets,
			"highRiskAssets": highRiskAssets,
			"expiringCerts":  expiringCerts,
		},
	})
}

// GetInventory returns the full list of scanned assets for the data tables
func GetInventory(c *fiber.Ctx) error {
	var subdomains []models.Subdomain

	// Preload automatically joins the Services and SSLCert tables
	db.DB.Preload("Services").Preload("SSLCert").Find(&subdomains)

	return c.JSON(subdomains)
}

// GetDomains returns the list of root domains added by the admin
func GetDomains(c *fiber.Ctx) error {
	var domains []models.Domain
	db.DB.Find(&domains)
	return c.JSON(domains)
}
