package handlers

import (
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// GetTopKPIs - GET /api/v1/dashboard/kpis
// Instantly calculates the high-level metrics for the top scorecards on the dashboard
func GetTopKPIs(c *fiber.Ctx) error {
	var totalAssets int64
	var liveAssets int64
	var quantumSafe int64
	var criticalRisk int64

	// 1. Total Subdomains Found (Alive or Dead)
	db.DB.Model(&models.Subdomain{}).Count(&totalAssets)

	// 2. Actually Alive / Reachable
	db.DB.Model(&models.Subdomain{}).Where("is_alive = ?", true).Count(&liveAssets)

	// 3. Quantum-Safe Assets (Elite Tier)
	db.DB.Model(&models.SSLCertificate{}).Where("pqc_tier = ?", "Elite").Count(&quantumSafe)

	// 4. Critical Risk (Expired certs OR legacy TLS 1.0/1.1)
	now := time.Now()
	db.DB.Model(&models.SSLCertificate{}).
		Where("valid_to < ? OR tls_version IN ?", now, []string{"TLS 1.0", "TLS 1.1", "SSLv3"}).
		Count(&criticalRisk)

	return c.JSON(fiber.Map{
		"total_assets":  totalAssets,
		"live_assets":   liveAssets,
		"quantum_safe":  quantumSafe,
		"critical_risk": criticalRisk,
	})
}

// RiskDistribution maps directly to a Donut or Pie Chart in React (e.g., Recharts)
type RiskDistribution struct {
	Tier  string `json:"name"`  // React charts usually want 'name'
	Count int    `json:"value"` // React charts usually want 'value'
}

// GetRiskDistribution - GET /api/v1/dashboard/charts/risk
func GetRiskDistribution(c *fiber.Ctx) error {
	var dist []RiskDistribution

	// Run an optimized SQL GROUP BY query to count the PQC Tiers
	// Translates to: SELECT pqc_tier as tier, count(id) as count FROM ssl_certificates GROUP BY pqc_tier;
	if err := db.DB.Model(&models.SSLCertificate{}).
		Select("pqc_tier as tier, count(id) as count").
		Group("pqc_tier").
		Scan(&dist).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to aggregate risk distribution"})
	}

	return c.JSON(dist)
}

// GetExpiryTimeline - GET /api/v1/dashboard/charts/expiry
// Feeds a Bar Chart to show upcoming certificate expirations
func GetExpiryTimeline(c *fiber.Ctx) error {
	now := time.Now()

	var expired, days30, days60, days90, safe int64

	db.DB.Model(&models.SSLCertificate{}).Where("valid_to < ?", now).Count(&expired)
	db.DB.Model(&models.SSLCertificate{}).Where("valid_to >= ? AND valid_to < ?", now, now.AddDate(0, 0, 30)).Count(&days30)
	db.DB.Model(&models.SSLCertificate{}).Where("valid_to >= ? AND valid_to < ?", now.AddDate(0, 0, 30), now.AddDate(0, 0, 60)).Count(&days60)
	db.DB.Model(&models.SSLCertificate{}).Where("valid_to >= ? AND valid_to < ?", now.AddDate(0, 0, 60), now.AddDate(0, 0, 90)).Count(&days90)
	db.DB.Model(&models.SSLCertificate{}).Where("valid_to >= ?", now.AddDate(0, 0, 90)).Count(&safe)

	// Format exactly how Recharts / Chart.js expects it
	timeline := []fiber.Map{
		{"name": "Already Expired", "count": expired, "fill": "#ef4444"},   // Tailwind Red
		{"name": "Expiring < 30 Days", "count": days30, "fill": "#f97316"}, // Tailwind Orange
		{"name": "Expiring < 60 Days", "count": days60, "fill": "#eab308"}, // Tailwind Yellow
		{"name": "Expiring < 90 Days", "count": days90, "fill": "#3b82f6"}, // Tailwind Blue
		{"name": "Safe (> 90 Days)", "count": safe, "fill": "#22c55e"},     // Tailwind Green
	}

	return c.JSON(timeline)
}
