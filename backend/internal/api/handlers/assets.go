package handlers

import (
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// AssetDTO is the exact flat structure the React frontend wants
type AssetDTO struct {
	ID                   uint   `json:"id"`
	RootDomain           string `json:"rootDomain"`
	AssetName            string `json:"assetName"`
	URL                  string `json:"url"`
	IPv4                 string `json:"ipv4"`
	Type                 string `json:"type"`
	CertStatus           string `json:"certStatus"`
	KeyLength            string `json:"keyLength"`
	CipherSuite          string `json:"cipherSuite"`
	TLSVersion           string `json:"tlsVersion"`
	CertificateAuthority string `json:"certificateAuthority"`
}

// GetReactAssets - GET /api/v1/assets
// Fetches relational data and flattens it for the React Dashboard
func GetReactAssets(c *fiber.Ctx) error {
	var subdomains []models.Subdomain

	// Fetch all ALIVE subdomains and Preload their Parent Domain and Crypto Certs
	if err := db.DB.Where("is_alive = ?", true).
		Preload("Domain").
		Preload("SSLCert").
		Find(&subdomains).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch assets"})
	}

	// Create an empty slice of our flat DTOs
	var flattenedAssets []AssetDTO

	// Loop through the relational database models and map them to the flat DTO
	for _, sub := range subdomains {

		// Set default values in case port 443 was closed and there is no TLS data
		certStatus := "No TLS"
		keyLen := "N/A"
		cipher := "N/A"
		tlsVer := "N/A"
		ca := "N/A"
		assetType := "Unknown"

		// If the scanner successfully grabbed a certificate for this subdomain
		if sub.SSLCert != nil {
			keyLen = sub.SSLCert.KeyLength
			cipher = sub.SSLCert.CipherSuite
			tlsVer = sub.SSLCert.TLSVersion
			ca = sub.SSLCert.Issuer
			assetType = "Web Server" // We know it's a web server if it returned a cert

			// Calculate Certificate Status on the fly
			if time.Now().After(sub.SSLCert.ValidTo) {
				certStatus = "Expired"
			} else if time.Until(sub.SSLCert.ValidTo).Hours() < (30 * 24) {
				certStatus = "Expiring Soon"
			} else {
				certStatus = "Valid"
			}
		}

		// Prevent panics if the Domain relation is missing
		rootName := "Unknown"
		if sub.Domain != nil {
			rootName = sub.Domain.DomainName
		}

		// Construct the final flat object for React
		flatAsset := AssetDTO{
			ID:                   sub.ID,
			RootDomain:           rootName,
			AssetName:            sub.Hostname,
			URL:                  "https://" + sub.Hostname,
			IPv4:                 sub.IPAddress,
			Type:                 assetType,
			CertStatus:           certStatus,
			KeyLength:            keyLen,
			CipherSuite:          cipher,
			TLSVersion:           tlsVer,
			CertificateAuthority: ca,
		}

		flattenedAssets = append(flattenedAssets, flatAsset)
	}

	// Return the perfect, flat JSON array
	return c.JSON(flattenedAssets)
}
