package handlers

import (
	"fmt"
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

// GetNetworkTopology - GET /api/v1/dashboard/topology
func GetNetworkTopology(c *fiber.Ctx) error {
	type Node struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Val   int    `json:"val"`
		Color string `json:"color"`
		Group int    `json:"group"`
	}

	type Link struct {
		Source string `json:"source"`
		Target string `json:"target"`
	}

	var nodes []Node
	var links []Link

	// 1. Fetch all domains and their subdomains with SSL certs
	var domains []models.Domain
	db.DB.Preload("Subdomains.SSLCert").Find(&domains)

	// 2. Build the Graph
	for _, d := range domains {
		// Add the Root Domain Node (The Center)
		nodes = append(nodes, Node{
			ID:    d.DomainName,
			Name:  "ROOT: " + d.DomainName,
			Val:   25,        // Larger size for root
			Color: "#800000", // PNB Maroon
			Group: 0,
		})

		// Loop through all subdomains (The Branches)
		for _, sub := range d.Subdomains {
			color := "#64748b" // Default gray (Unknown)
			statusLabel := "Unknown"

			if sub.SSLCert != nil {
				if sub.SSLCert.PQCTier == "Elite" {
					color = "#22c55e" // Green (Safe)
					statusLabel = "FIPS 203 Compliant"
				} else if sub.SSLCert.PQCTier == "Standard" {
					color = "#eab308" // Gold (Warning)
					statusLabel = "Classical (Transition)"
				} else {
					color = "#ef4444" // Red (Critical)
					statusLabel = "Vulnerable (HNDL Risk)"
				}
			}

			// Add the Subdomain Node
			nodes = append(nodes, Node{
				ID:    sub.Hostname,
				Name:  fmt.Sprintf("%s\nStatus: %s", sub.Hostname, statusLabel),
				Val:   10, // Smaller size for subdomains
				Color: color,
				Group: 1,
			})

			// Create a link connecting the subdomain back to the root
			links = append(links, Link{
				Source: d.DomainName,
				Target: sub.Hostname,
			})
		}
	}

	// 3. Return the exact JSON structure
	return c.JSON(fiber.Map{
		"nodes": nodes,
		"links": links,
	})
}
