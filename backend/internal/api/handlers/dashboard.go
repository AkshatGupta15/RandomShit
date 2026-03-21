package handlers

import (
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// GetTopKPIs - Natively calculates all metrics to prevent frontend crashes
func GetTopKPIs(c *fiber.Ctx) error {
	var totalAssets, liveAssets, quantumSafe, criticalRisk, tls13Count int64

	db.DB.Model(&models.Subdomain{}).Count(&totalAssets)
	db.DB.Model(&models.Subdomain{}).Where("is_alive = ?", true).Count(&liveAssets)
	db.DB.Model(&models.SSLCertificate{}).Where("pqc_tier = ?", "Elite").Count(&quantumSafe)

	now := time.Now()
	// Critical Risk = Expired Certs OR Legacy Protocols
	db.DB.Model(&models.SSLCertificate{}).
		Where("valid_to < ? OR tls_version IN ?", now, []string{"TLS 1.0", "TLS 1.1", "SSLv3"}).
		Count(&criticalRisk)

	db.DB.Model(&models.SSLCertificate{}).Where("tls_version = ?", "TLS 1.3").Count(&tls13Count)

	// Calculate Enterprise PQC Score (0-1000) safely in Go
	score := 400 // Base score
	if totalAssets > 0 {
		eliteBonus := int((float64(quantumSafe) / float64(totalAssets)) * 600)
		riskPenalty := int((float64(criticalRisk) / float64(totalAssets)) * 200)
		score = score + eliteBonus - riskPenalty
		if score > 1000 {
			score = 1000
		}
		if score < 0 {
			score = 0
		}
	} else {
		score = 0 // Fixes the NaN issue!
	}

	// Calculate TLS 1.3 Coverage Percentage
	tlsCoverage := 0
	if liveAssets > 0 {
		tlsCoverage = int((float64(tls13Count) / float64(liveAssets)) * 100)
	}

	return c.JSON(fiber.Map{
		"total_assets":  totalAssets,
		"live_assets":   liveAssets,
		"quantum_safe":  quantumSafe,
		"critical_risk": criticalRisk,
		"pqc_score":     score,
		"tls_coverage":  tlsCoverage,
	})
}

// GetRiskDistribution - Formats data perfectly for Recharts Donut Chart
func GetRiskDistribution(c *fiber.Ctx) error {
	var elite, standard, legacy int64
	db.DB.Model(&models.SSLCertificate{}).Where("pqc_tier = ?", "Elite").Count(&elite)
	db.DB.Model(&models.SSLCertificate{}).Where("pqc_tier = ?", "Standard").Count(&standard)
	db.DB.Model(&models.SSLCertificate{}).Where("pqc_tier = ?", "Legacy").Count(&legacy)

	// The 'fill' colors perfectly match your dark mode theme
	return c.JSON([]fiber.Map{
		{"name": "Elite (PQC)", "value": elite, "fill": "#22c55e"},    // Green
		{"name": "Standard", "value": standard, "fill": "#eab308"},    // Yellow
		{"name": "Legacy (Risk)", "value": legacy, "fill": "#ef4444"}, // Red
	})
}

// GetExpiryTimeline - Formats data perfectly for Recharts Bar Chart
func GetExpiryTimeline(c *fiber.Ctx) error {
	now := time.Now()
	var expired, days30, days60, days90, safe int64

	db.DB.Model(&models.SSLCertificate{}).Where("valid_to < ?", now).Count(&expired)
	db.DB.Model(&models.SSLCertificate{}).Where("valid_to >= ? AND valid_to < ?", now, now.AddDate(0, 0, 30)).Count(&days30)
	db.DB.Model(&models.SSLCertificate{}).Where("valid_to >= ? AND valid_to < ?", now.AddDate(0, 0, 30), now.AddDate(0, 0, 60)).Count(&days60)
	db.DB.Model(&models.SSLCertificate{}).Where("valid_to >= ? AND valid_to < ?", now.AddDate(0, 0, 60), now.AddDate(0, 0, 90)).Count(&days90)
	db.DB.Model(&models.SSLCertificate{}).Where("valid_to >= ?", now.AddDate(0, 0, 90)).Count(&safe)

	return c.JSON([]fiber.Map{
		{"name": "Expired", "count": expired, "fill": "#ef4444"},
		{"name": "< 30 Days", "count": days30, "fill": "#f97316"},
		{"name": "< 60 Days", "count": days60, "fill": "#eab308"},
		{"name": "< 90 Days", "count": days90, "fill": "#3b82f6"},
		{"name": "Safe (>90)", "count": safe, "fill": "#22c55e"},
	})
}
