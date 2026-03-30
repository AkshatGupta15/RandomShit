package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/core/scanner"
	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/go-pdf/fpdf"
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

// ENHANCED: CycloneDX 1.6 PQC Fields added
type CryptoProps struct {
	AssetType              string `json:"assetType"`
	Type                   string `json:"type,omitempty"`
	Primitive              string `json:"primitive,omitempty"`
	Algorithm              string `json:"algorithm"`
	ParameterSetIdentifier string `json:"parameterSetIdentifier,omitempty"`
	ClassicalSecurityLevel int    `json:"classicalSecurityLevel,omitempty"`
	SecurityLevel          string `json:"securityLevel"`
	NistFipsCompliant      bool   `json:"nistFipsCompliant"`
	ExecutionEnvironment   string `json:"executionEnvironment,omitempty"`
	State                  string `json:"state,omitempty"`
	OID                    string `json:"oid,omitempty"`
}

// ==========================================
// CBOM EXPORTS
// ==========================================

// GenerateCBOM - GET /api/v1/export/cbom/:domainId (Targeted)
func GenerateCBOM(c *fiber.Ctx) error {
	domainID := c.Params("domainId")

	// 1. Fetch the Root Domain (No nested preloads to avoid GORM silent failures)
	var domain models.Domain
	if err := db.DB.First(&domain, domainID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
	}

	// 2. Initialize the Base CBOM
	cbom := buildBaseCBOM(fmt.Sprintf("urn:uuid:pnb-pqc-domain-%s", domainID), domain.DomainName)

	// 3. Scan the Root Domain dynamically and add it as the first component
	rootReport := scanner.PerformDeepTLSScan(domain.DomainName, "")

	rootIsFips := rootReport.IsPQCEnabled
	rootSecLevel := "Legacy (Vulnerable)"
	rootClassSecLevel := 112 // Default RSA 2048 level
	rootParamSet := ""
	rootAlgorithm := rootReport.DetectedAlgorithm

	if rootIsFips {
		rootSecLevel = "NIST FIPS 203 (ML-KEM) Compliant"
		rootClassSecLevel = 128
		rootParamSet = "ML-KEM-768"
		rootAlgorithm = "ML-KEM"
	}

	rootComponent := Component{
		Type:        "cryptographic-asset",
		Name:        domain.DomainName, // The Root Domain
		Version:     rootReport.TLSVersion,
		Description: "Root Domain Endpoint",
		CryptoProperties: CryptoProps{
			AssetType:              "protocol",
			Type:                   "tls",
			Primitive:              "kem",
			Algorithm:              rootAlgorithm,
			ParameterSetIdentifier: rootParamSet,
			ClassicalSecurityLevel: rootClassSecLevel,
			SecurityLevel:          rootSecLevel,
			NistFipsCompliant:      rootIsFips,
			ExecutionEnvironment:   "software",
			State:                  "active",
		},
	}

	// Prepend the root domain to the components array
	cbom.Components = append(cbom.Components, rootComponent)

	// 4. 🟢 BULLETPROOF FETCH: Query Subdomains Directly 🟢
	var subdomains []models.Subdomain
	db.DB.Where("domain_id = ?", domain.ID).Preload("SSLCert").Find(&subdomains)

	for _, sub := range subdomains {
		if sub.SSLCert != nil {
			cbom.Components = append(cbom.Components, buildComponent(sub))
		}
	}

	// 5. Return the formatted JSON file
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"cbom_%s.json\"", domain.DomainName))
	c.Set("Content-Type", "application/json")

	formatted, err := json.MarshalIndent(cbom, "", "  ")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to serialize CBOM"})
	}

	return c.Send(formatted)
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

	formatted, err := json.MarshalIndent(cbom, "", "  ")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to serialize CBOM"})
	}

	return c.Send(formatted)
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
	primitive := "signature"
	algorithm := sub.SSLCert.KeyLength // e.g., "RSA 2048" or "ECDSA"
	paramSet := ""
	classSecLevel := 112 // Default for RSA 2048

	if isFips {
		secLevel = "NIST FIPS 203 (ML-KEM) Compliant"
		primitive = "kem"
		algorithm = "ML-KEM"
		paramSet = "ML-KEM-768"
		classSecLevel = 128
	} else if sub.SSLCert.PQCTier == "Standard" {
		secLevel = "Classical (Action Required)"
		classSecLevel = 128
	}

	return Component{
		Type:        "cryptographic-asset",
		Name:        sub.Hostname,
		Version:     sub.SSLCert.TLSVersion,
		Description: fmt.Sprintf("Certificate Issuer: %s", sub.SSLCert.Issuer),
		CryptoProperties: CryptoProps{
			AssetType:              "protocol",
			Type:                   "tls",
			Primitive:              primitive,
			Algorithm:              algorithm,
			ParameterSetIdentifier: paramSet,
			ClassicalSecurityLevel: classSecLevel,
			SecurityLevel:          secLevel,
			NistFipsCompliant:      isFips,
			ExecutionEnvironment:   "software",
			State:                  "active",
		},
	}
}
func generateAIDescription(prompt string) string {
	apiKey := os.Getenv("API_KEY")
	if apiKey == "" {
		log.Println("ERROR: GROQ_API_KEY not set")
		return "System Alert: Groq API key is not configured. AI Analysis skipped."
	}

	url := "https://api.groq.com/openai/v1/chat/completions"

	payload := map[string]interface{}{
		"model": "llama-3.3-70b-versatile", // 🟢 Upgraded to powerful 70B model
		"messages": []map[string]interface{}{
			{
				"role": "system",
				"content": `
You are both:
1. Chief Information Security Officer (CISO)
2. Senior Cryptography Engineer

Output STRICTLY in 2 sections:

Section 1: Executive Risk Summary
- 2 paragraphs
- Business + compliance + HNDL

Section 2: Technical Cryptographic Analysis
- Deep technical explanation
- Include:
  - TLS handshake behavior
  - Hybrid key exchange (X25519 + ML-KEM-768)
  - Forward secrecy implications
  - Backward compatibility risks
  - Attack surface (subdomains, downgrade risks)
  - Migration recommendations

No markdown. No bullet points. Clear structured paragraphs.
`,
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
		return "System Alert: Internal error preparing AI request."
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return "System Alert: Network error."
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "System Alert: Network error reaching Groq API."
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "System Alert: Failed to read AI response."
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(bodyBytes, &result); err != nil || len(result.Choices) == 0 {
		return "System Alert: Failed to parse AI response."
	}

	return result.Choices[0].Message.Content
}

// ==========================================
// PDF REPORT GENERATION
// ==========================================

// DownloadPDFReport - GET /api/v1/export/pdf-report/:domainId
// ==========================================
// PDF REPORT GENERATION
// ==========================================

// DownloadPDFReport - GET /api/v1/export/pdf-report/:domainId
func DownloadPDFReport(c *fiber.Ctx) error {
	domainID := c.Params("domainId")

	var domain models.Domain
	var subdomains []models.Subdomain
	var domainName string

	// 1. Fetch Domain & Subdomains
	if domainID != "" {
		if err := db.DB.First(&domain, domainID).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Domain not found"})
		}
		domainName = domain.DomainName

		// 🟢 FILTER: Only preload subdomains that have an associated SSL Certificate
		db.DB.Where("domain_id = ?", domain.ID).
			Preload("SSLCert").
			Preload("Services").
			Joins("JOIN ssl_certificates ON ssl_certificates.subdomain_id = subdomains.id").
			Find(&subdomains)
	} else {
		return c.Status(400).JSON(fiber.Map{"error": "Domain ID required"})
	}

	// 2. LIVE ROOT SCAN (for current dashboard state)
	rootReport := scanner.PerformDeepTLSScan(domainName, "")
	// Build AI prompt
	aiPrompt := fmt.Sprintf(`
Analyze this TLS and cryptographic posture:

Domain: %s
Key Exchange: %s
TLS Version: %s
Quantum Risk Score: %d%%
Security Score: %d/100
Subdomains: %d

Context:
- Hybrid PQC enabled if ML-KEM present
- Legacy risk if classical algorithms still active
- Assume attacker can store encrypted traffic today (HNDL threat)

Explain:
1. Security posture against quantum adversaries
2. TLS handshake and hybrid key exchange behavior
3. Risks due to mixed classical + PQC usage
4. Subdomain inconsistency risks
5. Required migration steps to full PQC
`, domainName, rootReport.DetectedAlgorithm, rootReport.TLSVersion, rootReport.QDayRisk, rootReport.SecurityScore, len(subdomains))
	aiSummary := generateAIDescription(aiPrompt)

	// 3. Document Setup
	pdf := fpdf.New("L", "mm", "A4", "") // Landscape for data density
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(true, 20)
	pdf.AddPage()

	// --- Header & Branding ---
	pdf.SetFont("Helvetica", "B", 26)
	pdf.SetTextColor(163, 17, 39) // PNB Maroon
	pdf.CellFormat(0, 12, "PNB QUANTUM SHIELD", "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "B", 12)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 6, "Post-Quantum Cryptographic Audit & Infrastructure Ledger", "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 5, fmt.Sprintf("Target: %s | Generated: %s", domainName, time.Now().Format("Jan 02, 2006")), "", 1, "L", false, 0, "")
	pdf.Ln(8)

	// --- 🟢 NEW: GUIDANCE SECTION (Report Explanation) 🟢 ---
	pdf.SetFillColor(245, 245, 245)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(30, 41, 59)
	pdf.CellFormat(0, 8, "  Methodology & Report Guidance", "LT R", 1, "L", true, 0, "")

	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(71, 85, 105)
	guidance := "This report evaluates infrastructure against NIST FIPS 203 (ML-KEM) standards. " +
		"A 'Safe' status indicates the endpoint supports Hybrid Post-Quantum Key Exchange, mitigating 'Harvest Now, Decrypt Later' (HNDL) risks. " +
		"Scores are calculated by starting at 100 and deducting points for: Legacy TLS versions (-15), Classical Key Exchange (-35), and Vulnerable Certificates (-5)."
	pdf.MultiCell(0, 5, guidance, "LBR", "L", true)
	pdf.Ln(8)

	// --- PRIMARY DOMAIN ANALYSIS (Dashboard Snapshot) ---
	pdf.SetFont("Helvetica", "B", 14)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFillColor(163, 17, 39)
	pdf.CellFormat(0, 9, fmt.Sprintf("  Section 1: Primary Domain Analysis (%s)", domainName), "", 1, "L", true, 0, "")
	pdf.Ln(2)

	// --- AI EXECUTIVE SUMMARY ---
	pdf.Ln(5)
	pdf.SetFont("Helvetica", "B", 14)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFillColor(15, 23, 42)
	pdf.CellFormat(0, 9, "  Section 1.1: AI Executive Risk Summary", "", 1, "L", true, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(40, 40, 40)
	// aiSummary = strings.ReplaceAll(aiSummary, "Section 1: Executive Risk Summary", "")
	// aiSummary = strings.ReplaceAll(aiSummary, "Section 2: Technical Cryptographic Analysis", "")
	parts := strings.SplitN(aiSummary, "Section 2:", 2)

	pdf.MultiCell(0, 6, parts[0], "1", "L", false)

	pdf.Ln(3)
	pdf.SetFont("Helvetica", "B", 12)
	pdf.CellFormat(0, 8, "Technical Analysis", "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "", 10)
	pdf.MultiCell(0, 6, "Section 2:"+parts[1], "1", "L", false)
	pdf.Ln(5)

	// Dashboard-style metrics
	pdf.SetFont("Helvetica", "B", 10)
	pdf.SetTextColor(50, 50, 50)
	pdf.SetFillColor(248, 250, 252)
	pdf.CellFormat(66, 10, "Algorithm: "+rootReport.DetectedAlgorithm, "1", 0, "C", true, 0, "")
	pdf.CellFormat(66, 10, fmt.Sprintf("Data Risk: %d%%", rootReport.QDayRisk), "1", 0, "C", true, 0, "")
	pdf.CellFormat(66, 10, fmt.Sprintf("NIST Score: %d/100", rootReport.SecurityScore), "1", 0, "C", true, 0, "")
	pdf.CellFormat(69, 10, "Readiness: "+rootReport.TLSVersion, "1", 1, "C", true, 0, "")
	pdf.Ln(5)

	// Telemetry & Proof
	pdf.SetFont("Helvetica", "B", 10)
	pdf.SetTextColor(163, 17, 39)
	pdf.CellFormat(130, 6, "Live Handshake Telemetry:", "", 0, "L", false, 0, "")
	pdf.CellFormat(0, 6, "Deterministic Score Calculation:", "", 1, "L", false, 0, "")

	pdf.SetFont("Courier", "", 8)
	pdf.SetTextColor(80, 80, 80)
	yStart := pdf.GetY()
	pdf.MultiCell(125, 4, rootReport.HandshakeText, "1", "L", false)

	pdf.SetXY(145, yStart)
	for _, log := range rootReport.ScoreBreakdown {
		pdf.SetX(145)
		pdf.CellFormat(0, 4, "> "+log, "", 1, "L", false, 0, "")
	}
	pdf.SetY(yStart + 25) // Ensure we move past the multicell
	pdf.Ln(10)

	// --- 🟢 ASSET MATRIX (Only shows domains with TLS) 🟢 ---
	pdf.SetFont("Helvetica", "B", 14)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFillColor(30, 41, 59)
	pdf.CellFormat(0, 9, "  Section 2: Discovered Asset Discovery Matrix", "", 1, "L", true, 0, "")
	pdf.Ln(2)

	// Table Headers
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetFillColor(226, 232, 240)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(75, 8, "Endpoint / Hostname", "1", 0, "L", true, 0, "")
	pdf.CellFormat(65, 8, "Algorithm (Key Exchange)", "1", 0, "L", true, 0, "")
	pdf.CellFormat(35, 8, "Transport", "1", 0, "C", true, 0, "")
	pdf.CellFormat(60, 8, "Certificate Issuer", "1", 0, "L", true, 0, "")
	pdf.CellFormat(32, 8, "Status", "1", 1, "C", true, 0, "")

	// Table Rows
	pdf.SetFont("Helvetica", "", 8)
	for i, sub := range subdomains {
		if sub.SSLCert == nil {
			continue
		} // Redundant safety

		if i%2 == 0 {
			pdf.SetFillColor(255, 255, 255)
		} else {
			pdf.SetFillColor(249, 250, 251)
		}

		status := "At Risk"
		if sub.SSLCert.PQCTier == "Elite" || sub.SSLCert.QScore >= 80 {
			status = "PQC Safe"
			pdf.SetTextColor(5, 150, 105)
		} else {
			pdf.SetTextColor(185, 28, 28)
		}

		pdf.CellFormat(75, 8, sub.Hostname, "1", 0, "L", true, 0, "")
		pdf.SetTextColor(50, 50, 50)
		pdf.CellFormat(65, 8, sub.SSLCert.KeyLength, "1", 0, "L", true, 0, "")
		pdf.CellFormat(35, 8, sub.SSLCert.TLSVersion, "1", 0, "C", true, 0, "")
		pdf.CellFormat(60, 8, sub.SSLCert.Issuer, "1", 0, "L", true, 0, "")

		if status == "PQC Safe" {
			pdf.SetTextColor(5, 150, 105)
		} else {
			pdf.SetTextColor(185, 28, 28)
		}
		pdf.CellFormat(32, 8, status, "1", 1, "C", true, 0, "")
	}

	// 5. Stream to response
	var out bytes.Buffer
	pdf.Output(&out)
	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=PNB_Audit_%s.pdf", domainName))
	return c.SendStream(bytes.NewReader(out.Bytes()))
}
