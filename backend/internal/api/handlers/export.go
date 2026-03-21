package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// --- CycloneDX CBOM Structures ---
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

// ==========================================
// CBOM EXPORTS
// ==========================================

// GenerateCBOM - GET /api/v1/export/cbom/:domainId (Targeted)
func GenerateCBOM(c *fiber.Ctx) error {
	domainID := c.Params("domainId")

	var domain models.Domain
	if err := db.DB.Preload("Subdomains.SSLCert").First(&domain, domainID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
	}

	cbom := buildBaseCBOM(fmt.Sprintf("urn:uuid:pnb-pqc-domain-%s", domainID), domain.DomainName)

	for _, sub := range domain.Subdomains {
		if sub.SSLCert != nil {
			cbom.Components = append(cbom.Components, buildComponent(sub))
		}
	}

	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"cbom_%s.json\"", domain.DomainName))
	c.Set("Content-Type", "application/json")
	return c.JSON(cbom)
}

// DownloadCBOMJson - GET /api/v1/export/cbom (Global Enterprise)
func DownloadCBOMJson(c *fiber.Ctx) error {
	var certs []models.SSLCertificate
	db.DB.Preload("Subdomain").Find(&certs)

	cbom := buildBaseCBOM("urn:uuid:pnb-pqc-global-inventory", "Entire PNB Infrastructure")

	for _, cert := range certs {
		if cert.Subdomain != nil {
			cbom.Components = append(cbom.Components, buildComponent(*cert.Subdomain))
		}
	}

	c.Set("Content-Disposition", "attachment; filename=\"pnb_global_cbom.json\"")
	c.Set("Content-Type", "application/json")
	return c.JSON(cbom)
}

// Helper function to keep CBOM logic DRY
func buildBaseCBOM(serial string, name string) CBOM {
	return CBOM{
		BOMFormat:    "CycloneDX",
		SpecVersion:  "1.6",
		SerialNumber: serial,
		Version:      1,
		Metadata: Metadata{
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Component: struct {
				Type string `json:"type"`
				Name string `json:"name"`
			}{Type: "application", Name: name},
		},
	}
}

// Helper function to map database models to CycloneDX Components
func buildComponent(sub models.Subdomain) Component {
	isFips := sub.SSLCert.PQCTier == "Elite"
	secLevel := "Legacy (Vulnerable)"
	if isFips {
		secLevel = "NIST FIPS 203 (ML-KEM) Compliant"
	} else if sub.SSLCert.PQCTier == "Standard" {
		secLevel = "Classical (Action Required)"
	}

	return Component{
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
}

// ==========================================
// GEMINI AI INTEGRATION
// ==========================================
func generateAIDescription(prompt string) string {
	apiKey := os.Getenv("API_KEY")
	if apiKey == "" {
		log.Println("ERROR: GROQ_API_KEY not set")
		return "System Alert: Groq API key is not configured."
	}

	url := "https://api.groq.com/openai/v1/chat/completions"

	payload := map[string]interface{}{
		"model": "llama-3.3-70b-versatile", // free model with good performance
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": "You are an elite Cyber Threat Analyst for Punjab National Bank. Write in a formal, authoritative, banking-executive tone. No markdown formatting.",
			},
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"temperature": 0.2,
		"max_tokens":  500,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal payload: %v", err)
		return "System Alert: Internal error preparing AI request."
	}

	log.Printf("Sending request to Groq: %s", url)
	log.Printf("Request body: %s", string(body))

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("Failed to create request: %v", err)
		return "System Alert: Network error."
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Network error: %v", err)
		return "System Alert: Network error reaching Groq API."
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read response: %v", err)
		return "System Alert: Failed to read AI response."
	}
	log.Printf("Response status: %d, body: %s", resp.StatusCode, string(bodyBytes))

	if resp.StatusCode != 200 {
		return fmt.Sprintf("System Alert: Groq API error (HTTP %d). Check logs.", resp.StatusCode)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		log.Printf("Failed to decode response: %v", err)
		return "System Alert: Failed to parse AI response."
	}

	if len(result.Choices) == 0 {
		log.Printf("No choices in response")
		return "System Alert: AI returned no content."
	}

	text := result.Choices[0].Message.Content
	log.Printf("AI response: %s", text)
	return text
}

// ==========================================
// PDF REPORT GENERATION
// ==========================================

// DownloadPDFReport - Handles BOTH GET /api/v1/export/pdf-report and /pdf-report/:domainId
func DownloadPDFReport(c *fiber.Ctx) error {
	domainID := c.Params("domainId")

	var domainName, domainDescription string
	var totalAssets, eliteAssets, legacyAssets int64

	// If a specific Domain ID was passed, filter for it
	if domainID != "" {
		var domain models.Domain
		if err := db.DB.Preload("Subdomains.SSLCert").First(&domain, domainID).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
		}
		domainName = domain.DomainName
		domainDescription = fmt.Sprintf("Target Domain: %s", domain.DomainName)

		totalAssets = int64(len(domain.Subdomains))
		for _, sub := range domain.Subdomains {
			if sub.SSLCert != nil {
				if sub.SSLCert.PQCTier == "Elite" {
					eliteAssets++
				} else if sub.SSLCert.PQCTier != "Elite" {
					legacyAssets++
				}
			}
		}
	} else {
		// Global Infrastructure Report
		domainName = "Entire PNB Infrastructure"
		domainDescription = "Global Enterprise Assets"
		db.DB.Model(&models.Subdomain{}).Count(&totalAssets)
		db.DB.Model(&models.SSLCertificate{}).Where("pqc_tier = ?", "Elite").Count(&eliteAssets)
		db.DB.Model(&models.SSLCertificate{}).Where("pqc_tier != ?", "Elite").Count(&legacyAssets)
	}

	// The tuned Gemini Prompt
	aiPrompt := fmt.Sprintf(`Analyze the following Post-Quantum Cryptography (PQC) metrics for %s:
- Total Endpoints: %d
- Quantum-Safe (NIST FIPS 203 ML-KEM): %d
- Vulnerable/Legacy Protocols: %d

Provide a concise, 2-paragraph executive summary. Focus on the immediate risk of 'Harvest Now, Decrypt Later' (HNDL) attacks against the legacy assets, and outline the strategic compliance posture. Keep it extremely professional.`,
		domainName, totalAssets, eliteAssets, legacyAssets)

	aiSummary := generateAIDescription(aiPrompt)
	formattedSummary := strings.ReplaceAll(html.EscapeString(aiSummary), "\n", "<br>")

	pm := 0.0
	if totalAssets > 0 {
		pm = (float64(eliteAssets) / float64(totalAssets)) * 100.0
	}

	htmlContent := fmt.Sprintf(`
		<html>
		<head>
			<title>PNB Quantum Shield - Executive Report</title>
			<style>
				body { font-family: Inter, -apple-system, sans-serif; padding: 40px; color: #1f2937; line-height: 1.6; }
				.header { border-bottom: 4px solid #800000; padding-bottom: 15px; margin-bottom: 30px; }
				.pnb-logo { color: #800000; font-size: 32px; font-weight: 900; letter-spacing: -0.5px; }
				.stat-box { background: #f8fafc; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
				.stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; }
				.stat-item { border-left: 3px solid #800000; padding-left: 15px; }
				.stat-value { font-size: 24px; font-weight: bold; color: #111827; }
				.stat-label { font-size: 13px; color: #6b7280; text-transform: uppercase; }
				.ai-box { background: #fffbeb; border: 1px solid #fde68a; padding: 25px; border-radius: 12px; }
				.section-head { font-size: 18px; font-weight: 700; margin-bottom: 15px; }
				.badge { background: #800000; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
				@media print { button { display: none; } body { padding: 0; } }
			</style>
		</head>
		<body>
			<div class="header">
				<div class="pnb-logo">PNB QUANTUM SHIELD</div>
				<h1 style="margin: 5px 0 0 0; font-size: 20px;">Executive PQC Security Audit</h1>
				<p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">Date: %s | Scope: %s</p>
			</div>

			<div class="stat-box">
				<div class="section-head">Infrastructure Overview</div>
				<div class="stat-grid">
					<div class="stat-item">
						<div class="stat-value">%d</div>
						<div class="stat-label">Total Assets Scanned</div>
					</div>
					<div class="stat-item">
						<div class="stat-value" style="color: #059669;">%0.1f%%</div>
						<div class="stat-label">NIST FIPS 203 Readiness</div>
					</div>
					<div class="stat-item">
						<div class="stat-value" style="color: #059669;">%d</div>
						<div class="stat-label">Elite ML-KEM Assets</div>
					</div>
					<div class="stat-item">
						<div class="stat-value" style="color: #dc2626;">%d</div>
						<div class="stat-label">Legacy / Vulnerable Assets</div>
					</div>
				</div>
			</div>

			<div class="ai-box">
				<div class="section-head">
					<span class="badge" style="margin-right: 8px;">Gemini AI Analysis</span>
					Strategic Insights
				</div>
				<p style="margin: 0; color: #4b5563;">%s</p>
			</div>

			<button onclick="window.print()" style="margin-top: 30px; background: #800000; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print PDF Report</button>
		</body>
		</html>
	`, time.Now().Format("January 02, 2026"), domainDescription, totalAssets, pm, eliteAssets, legacyAssets, formattedSummary)

	c.Set("Content-Type", "text/html")
	return c.SendString(htmlContent)
}

// curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyDBKH5WGQKBSC_CNcukLMEmDKDCwLihT_4" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "contents": [{"parts":[{"text":"Hello, world"}]}]
//   }'
