package handlers

import (
	"fmt"
	"quantum-scanner/internal/core/scanner"
	"quantum-scanner/internal/db"
	"quantum-scanner/internal/models"

	"github.com/gofiber/fiber/v2"
)

// AdminScanRequest is what React sends to Go
type AdminScanRequest struct {
	Domain            string `json:"domain"`
	IncludeSubdomains bool   `json:"includeSubdomains"`
}

func TriggerScan(c *fiber.Ctx) error {
	var req AdminScanRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	var scannedAssets []scanner.DetailedAsset

	// LOGIC SWITCH: Check the frontend checkbox value
	if req.IncludeSubdomains {
		fmt.Printf("[API] Admin requested FULL scan for: %s\n", req.Domain)
		// Calls the massive subdomain discovery engine we built earlier
		scannedAssets = scanner.DiscoverAndScan(req.Domain)
	} else {
		fmt.Printf("[API] Admin requested SINGLE scan for: %s\n", req.Domain)
		// Just resolve the single root domain and scan it
		ip := scanner.ResolveSingleIP(req.Domain) // You will need to add a quick helper for this
		if ip != "" {
			asset := scanner.ScanTLS(req.Domain, ip)
			if asset != nil {
				scannedAssets = append(scannedAssets, *asset)
			}
		}
	}

	if len(scannedAssets) == 0 {
		return c.Status(404).JSON(fiber.Map{"message": "No secure assets found or domains offline."})
	}

	// CONVERT to DB Models and SAVE
	var dbRecords []models.Asset
	for _, a := range scannedAssets {
		record := models.Asset{
			RootDomain:           req.Domain,
			AssetName:            a.AssetName,
			URL:                  a.URL,
			IPv4:                 a.IPv4,
			Type:                 a.Type,
			CertStatus:           a.CertStatus,
			KeyLength:            a.KeyLength,
			CipherSuite:          a.CipherSuite,
			TLSVersion:           a.TLSVersion,
			CertificateAuthority: a.CertificateAuthority,
		}
		dbRecords = append(dbRecords, record)
	}

	// Insert all found assets into PostgreSQL in one massive transaction
	// OnConflict ensures if we scan the same domain twice, it updates rather than crashing
	db.DB.Save(&dbRecords)

	return c.Status(200).JSON(fiber.Map{
		"message": fmt.Sprintf("Successfully scanned and stored %d assets.", len(dbRecords)),
		"assets":  dbRecords,
	})
}

// FetchInventory returns all saved assets to populate the React tables
func GetInventory(c *fiber.Ctx) error {
	var assets []models.Asset
	db.DB.Find(&assets)
	return c.JSON(assets)
}
