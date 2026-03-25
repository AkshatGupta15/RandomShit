// backend/internal/api/handlers/domain.go
package handlers

import (
	"context"
	"math"
	"strings"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/likexian/whois"
	whoisparser "github.com/likexian/whois-parser"
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
// Allows the admin to manually add a new target and fetches real WHOIS data
func AddRootDomain(c *fiber.Ctx) error {
	var req AddDomainRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON payload"})
	}

	// Clean up the input (remove spaces, make lowercase, strip https://)
	cleanDomain := strings.TrimSpace(strings.ToLower(req.Domain))
	cleanDomain = strings.TrimPrefix(cleanDomain, "https://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "http://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "www.") // Good practice to remove www as well

	if cleanDomain == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Domain name cannot be empty"})
	}

	// Check if the domain is already in the database
	var existing models.Domain
	db.DB.Where("domain_name = ?", cleanDomain).First(&existing)
	if existing.ID != 0 {
		return c.JSON(fiber.Map{
			"message": "Domain is already being tracked",
			"domain":  existing,
		})
	}

	//  1. FETCH REAL WHOIS DATA
	companyName := "Unknown Entity"
	registrarName := "Unknown Registrar"
	creationDate := "Unknown Date"

	// Execute native WHOIS query
	rawWhois, err := whois.Whois(cleanDomain)
	if err == nil {
		// Parse the raw text into structured data
		parsedWhois, parseErr := whoisparser.Parse(rawWhois)
		if parseErr == nil {
			if parsedWhois.Registrar != nil && parsedWhois.Registrar.Name != "" {
				registrarName = parsedWhois.Registrar.Name
			}
			if parsedWhois.Registrant != nil && parsedWhois.Registrant.Organization != "" {
				companyName = parsedWhois.Registrant.Organization
			}
			if parsedWhois.Domain != nil && parsedWhois.Domain.CreatedDate != "" {
				// Format to a clean date string (YYYY-MM-DD)
				parsedTime, _ := time.Parse(time.RFC3339, parsedWhois.Domain.CreatedDate)
				if !parsedTime.IsZero() {
					creationDate = parsedTime.Format("2006-01-02")
				} else {
					creationDate = parsedWhois.Domain.CreatedDate
				}
			}
		}
	}

	//  2. SAVE TO POSTGRESQL WITH ALL DATA sortedSubdomains
	newDomain := models.Domain{
		DomainName:       cleanDomain,
		Status:           "pending",
		RiskLevel:        "Pending Scan",
		TotalAssets:      0,
		ScannedAssets:    0,
		Endpoints:        0,
		CompanyName:      companyName,   // Sourced from WHOIS
		Registrar:        registrarName, // Sourced from WHOIS
		RegistrationDate: creationDate,  // Sourced from WHOIS
		DetectionDate:    time.Now(),
	}

	if err := db.DB.Create(&newDomain).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save domain to database"})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "Domain added successfully with WHOIS Intelligence",
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

	// Stop any active scans for this domain before deleting (Assuming ActiveScans is a global sync.Map defined elsewhere)
	// Note: If ActiveScans is defined in another file in the handlers package, this will work perfectly.
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

// GetDomainDetails - GET /api/v1/domains/:id
// GetDomainDetails - GET /api/v1/domains/:id
func GetDomainDetails(c *fiber.Ctx) error {
	id := c.Params("id")
	var domain models.Domain

	// Preload all subdomains and their associated SSL Certificates
	if err := db.DB.Preload("Subdomains.SSLCert").First(&domain, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
	}

	//  1. CALCULATE METRICS ON THE BACKEND (AVERAGE Q-SCORE)
	totalClean := 0
	totalQScore := 0

	for _, sub := range domain.Subdomains {
		if sub.SSLCert != nil {
			totalClean++
			// Assuming your struct field is named QScore
			totalQScore += sub.SSLCert.QScore
		}
	}

	pqcScore := 0
	if totalClean > 0 {
		// Calculate the average Q-Score (0-100)
		avgQ := float64(totalQScore+10) / float64(totalClean)
		// Multiply by 10 to scale it to the 1000-point enterprise metric
		pqcScore = int(math.Round(avgQ * 10))
	}

	//  2. DETERMINE DYNAMIC RISK POSTURE
	riskLevel := "Pending Scan"
	riskSubtitle := "Awaiting discovery..."
	riskColor := "muted"

	if totalClean > 0 {
		if pqcScore >= 750 {
			riskLevel = "Quantum Safe"
			riskSubtitle = "FIPS 203 Compliant"
			riskColor = "green"
		} else if pqcScore >= 500 {
			riskLevel = "Moderate Risk"
			riskSubtitle = "Transition Required"
			riskColor = "yellow"
		} else {
			riskLevel = "Critical Risk"
			riskSubtitle = "HNDL Vulnerability Active"
			riskColor = "red"
		}
	}
	//  3. CREATE ENRICHED RESPONSE DTO
	// This embeds your DB model but overwrites/adds the dynamic fields for the frontend
	type DomainResponse struct {
		models.Domain
		PQCScore     int    `json:"pqc_score"`
		RiskLevel    string `json:"risk_level"`
		RiskSubtitle string `json:"risk_subtitle"`
		RiskColor    string `json:"risk_color"`
		TotalClean   int    `json:"total_clean"`
	}

	res := DomainResponse{
		Domain:       domain,
		PQCScore:     pqcScore,
		RiskLevel:    riskLevel,
		RiskSubtitle: riskSubtitle,
		RiskColor:    riskColor,
		TotalClean:   totalClean,
	}

	return c.JSON(res)
}
