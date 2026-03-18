package handlers

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// CycloneDX structures
type CBOM struct {
	BOMFormat    string      `json:"bomFormat"`
	SpecVersion  string      `json:"specVersion"`
	SerialNumber string      `json:"serialNumber"`
	Version      int         `json:"version"`
	Metadata     Metadata    `json:"metadata"`
	Components   []Component `json:"components"`
}

type Metadata struct {
	Timestamp string `json:"timestamp"`
	Component struct {
		Type string `json:"type"`
		Name string `json:"name"`
	} `json:"component"`
}

type Component struct {
	Type             string      `json:"type"`
	Name             string      `json:"name"`
	Version          string      `json:"version"`
	Description      string      `json:"description,omitempty"`
	CryptoProperties CryptoProps `json:"cryptoProperties,omitempty"`
}

type CryptoProps struct {
	AssetType         string `json:"assetType"`
	Algorithm         string `json:"algorithm"`
	SecurityLevel     string `json:"securityLevel"`
	NistFipsCompliant bool   `json:"nistFipsCompliant"`
}

// GenerateCBOM - GET /api/v1/export/cbom/:domainId
func GenerateCBOM(c *fiber.Ctx) error {
	domainID := c.Params("domainId")

	var domain models.Domain
	if err := db.DB.Preload("Subdomains.SSLCert").First(&domain, domainID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
	}

	// 1. Build the base CBOM structure
	cbom := CBOM{
		BOMFormat:    "CycloneDX",
		SpecVersion:  "1.6",
		SerialNumber: fmt.Sprintf("urn:uuid:pnb-pqc-%s", domainID),
		Version:      1,
		Metadata: Metadata{
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
	}
	cbom.Metadata.Component.Type = "application"
	cbom.Metadata.Component.Name = domain.DomainName

	// 2. Loop through our Go database and format to CycloneDX standard
	for _, sub := range domain.Subdomains {
		if sub.SSLCert != nil {

			// FIPS 203/204 Compliance Logic
			isFips := false
			secLevel := "Legacy (Vulnerable)"
			if sub.SSLCert.PQCTier == "Elite" {
				isFips = true
				secLevel = "NIST FIPS 203 (ML-KEM) Compliant"
			} else if sub.SSLCert.PQCTier == "Standard" {
				secLevel = "Classical (Action Required)"
			}

			comp := Component{
				Type:        "cryptographic-asset",
				Name:        sub.Hostname,
				Version:     sub.SSLCert.TLSVersion,
				Description: fmt.Sprintf("Certificate Issuer: %s", sub.SSLCert.Issuer),
				CryptoProperties: CryptoProps{
					AssetType:         "certificate",
					Algorithm:         sub.SSLCert.KeyLength,
					SecurityLevel:     secLevel,
					NistFipsCompliant: isFips,
				},
			}
			cbom.Components = append(cbom.Components, comp)
		}
	}

	// 3. Force the browser to download it as a JSON file, not just display it
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"cbom_%s.json\"", domain.DomainName))
	c.Set("Content-Type", "application/json")

	// Convert to pretty JSON and return
	jsonBytes, _ := json.MarshalIndent(cbom, "", "  ")
	return c.Send(jsonBytes)
}

// DownloadCBOMJson - GET /api/v1/export/cbom
func DownloadCBOMJson(c *fiber.Ctx) error {
	var certs []models.SSLCertificate

	// Pull all certificates to map out the crypto inventory
	db.DB.Preload("Subdomain").Find(&certs)

	// Define the CycloneDX 1.6 Structure (Simplified for Hackathon)
	type CBOM struct {
		BOMFormat   string        `json:"bomFormat"`
		SpecVersion string        `json:"specVersion"`
		Timestamp   string        `json:"timestamp"`
		Components  []interface{} `json:"components"`
	}

	var components []interface{}
	for _, cert := range certs {
		components = append(components, fiber.Map{
			"type": "cryptographic-asset",
			"name": cert.Subdomain.Hostname,
			"cryptoProperties": fiber.Map{
				"assetType":     "certificate",
				"algorithm":     cert.KeyLength,
				"pqc_tier":      cert.PQCTier,
				"tls_version":   cert.TLSVersion,
				"cipher_suite":  cert.CipherSuite,
				"nist_fips_203": cert.PQCTier == "Elite",
			},
		})
	}

	report := CBOM{
		BOMFormat:   "CycloneDX",
		SpecVersion: "1.6",
		Timestamp:   time.Now().Format(time.RFC3339),
		Components:  components,
	}

	c.Set("Content-Disposition", "attachment; filename=pnb_cbom_report.json")
	return c.JSON(report)
}

// DownloadPDFReport - GET /api/v1/export/pdf-report
// return a beautifully formatted HTML "Print View" that looks like a PDF.
func DownloadPDFReport(c *fiber.Ctx) error {
	var totalAssets int64
	var eliteAssets int64
	db.DB.Model(&models.Subdomain{}).Count(&totalAssets)
	db.DB.Model(&models.SSLCertificate{}).Where("pqc_tier = ?", "Elite").Count(&eliteAssets)

	// This HTML is designed to look like a formal PNB Security Document
	htmlContent := fmt.Sprintf(`
		<html>
		<head>
			<style>
				body { font-family: sans-serif; padding: 50px; color: #333; }
				.header { border-bottom: 3px solid #800000; padding-bottom: 10px; }
				.pnb-logo { color: #800000; font-size: 24px; font-weight: bold; }
				.stat-box { background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0; }
				.footer { margin-top: 50px; font-size: 12px; color: #777; border-top: 1px solid #ddd; padding-top: 10px; }
			</style>
		</head>
		<body>
			<div class="header">
				<span class="pnb-logo">PNB Quantum Shield</span>
				<h1 style="margin:0">Executive Risk Report</h1>
			</div>
			<p><strong>Date:</strong> %s</p>
			<p>This report summarizes the Post-Quantum Cryptographic (PQC) readiness for <strong>pnbindia.in</strong> infrastructure.</p>
			
			<div class="stat-box">
				<h2>Infrastructure Summary</h2>
				<p>Total Assets Scanned: %d</p>
				<p>Quantum-Safe Assets (ML-KEM): %d</p>
				<p>Quantum Risk Level: <span style="color: orange; font-weight:bold;">MODERATE</span></p>
			</div>

			<h3>Compliance & Guidance</h3>
			<ul>
				<li>NIST FIPS 203 (ML-KEM) Readiness: %0.2f%%</li>
				<li>Legacy Protocol (TLS 1.0/1.1) Status: Remediation Required</li>
			</ul>

			<div class="footer">
				Generated by PNB Internal Cybersecurity Hackathon 2026 - Go-Scanner Engine v1.0
			</div>
			<script>window.print();</script>
		</body>
		</html>
	`, time.Now().Format("Jan 02, 2026"), totalAssets, eliteAssets, (float64(eliteAssets)/float64(totalAssets))*100)

	c.Set("Content-Type", "text/html")
	return c.SendString(htmlContent)
}
