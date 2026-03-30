package handlers

import (
	"crypto/tls"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type EnrichedPQCReport struct {
	Hostname          string   `json:"hostname"`
	IsPQCEnabled      bool     `json:"is_pqc_enabled"`
	DetectedAlgorithm string   `json:"detected_algorithm"`
	TLSVersion        string   `json:"tls_version"`
	QDayRisk          int      `json:"q_day_risk"`
	SecurityScore     int      `json:"security_score"`
	QKDStatus         string   `json:"qkd_status"`
	HandshakeText     string   `json:"handshake_text"`
	ThreatLevel       int      `json:"threat_level"`
	Readiness         int      `json:"readiness"`
	HardeningRoadmap  []string `json:"hardening_roadmap"`
	LegacyWeaknesses  []string `json:"legacy_weaknesses"`
}

type QuickScanRequest struct {
	Domain string `json:"domain"`
}

// PerformDeepTLSScan conducts the handshake and generates the enriched analytics
func PerformDeepTLSScan(hostname string) EnrichedPQCReport {
	report := EnrichedPQCReport{
		Hostname:  hostname,
		QKDStatus: "UNAVAILABLE", // QKD requires specialized optical hardware, always unavailable for web
	}

	address := fmt.Sprintf("%s:443", hostname)
	config := &tls.Config{
		ServerName: hostname,
		CurvePreferences: []tls.CurveID{
			tls.X25519MLKEM768, // NIST FIPS 203 Hybrid (Go 1.24+)
			tls.X25519,
			tls.CurveP256,
		},
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: true,
	}

	dialer := &net.Dialer{Timeout: 4 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", address, config)

	if err != nil {
		report.DetectedAlgorithm = "OFFLINE"
		report.SecurityScore = 0
		report.ThreatLevel = 100
		return report
	}
	defer conn.Close()

	state := conn.ConnectionState()
	report.TLSVersion = tls.VersionName(state.Version)
	cipher := tls.CipherSuiteName(state.CipherSuite)

	// Defaults
	report.HardeningRoadmap = []string{}
	report.LegacyWeaknesses = []string{}

	// Evaluate Certificate Authority
	// certType := "RSA"
	// Evaluate Certificate Authority (Removed unused certType variable)
	if len(state.PeerCertificates) > 0 {
		pkAlgo := state.PeerCertificates[0].PublicKeyAlgorithm.String()
		if strings.Contains(pkAlgo, "ECDSA") {
			report.LegacyWeaknesses = append(report.LegacyWeaknesses, "Legacy ECDSA certificates")
			report.HardeningRoadmap = append(report.HardeningRoadmap, "Transition to ML-DSA for server authentication")
		} else {
			report.LegacyWeaknesses = append(report.LegacyWeaknesses, "Classic RSA certificates")
			report.HardeningRoadmap = append(report.HardeningRoadmap, "Transition to ML-DSA (FIPS 204) for server authentication")
		}
	}

	// Categorize Key Exchange & Calculate Scores (Removed Draft00 check)
	if state.CurveID == tls.X25519MLKEM768 {
		report.IsPQCEnabled = true
		report.DetectedAlgorithm = "X25519MLKEM768"
		report.QDayRisk = 15 // Slight risk from metadata/SNDL
		report.SecurityScore = 98
		report.ThreatLevel = 15
		report.Readiness = 98
		report.HandshakeText = fmt.Sprintf("Hybrid post-quantum key exchange detected using %s over %s.", report.DetectedAlgorithm, report.TLSVersion)
		report.LegacyWeaknesses = append(report.LegacyWeaknesses, "Classic RSA key exchange fallback support")
		report.HardeningRoadmap = append(report.HardeningRoadmap, "Hardening of client-side PQC negotiation enforcement")
	} else if state.CurveID == tls.X25519 {
		report.IsPQCEnabled = false
		report.DetectedAlgorithm = "X25519 (Classical)"
		report.QDayRisk = 65
		report.SecurityScore = 60
		report.ThreatLevel = 65
		report.Readiness = 40
		report.HandshakeText = fmt.Sprintf("Standard elliptic curve key exchange (%s) negotiated over %s. Vulnerable to Shor's Algorithm.", report.DetectedAlgorithm, report.TLSVersion)
		report.HardeningRoadmap = append(report.HardeningRoadmap, "Upgrade server to support ML-KEM (FIPS 203) Key Encapsulation")
	} else {
		report.IsPQCEnabled = false
		report.DetectedAlgorithm = "RSA / P-256"
		report.QDayRisk = 95
		report.SecurityScore = 20
		report.ThreatLevel = 95
		report.Readiness = 10
		report.HandshakeText = fmt.Sprintf("Legacy cryptography negotiated (%s). Highly vulnerable to HNDL attacks.", cipher)
		report.HardeningRoadmap = append(report.HardeningRoadmap, "Immediate upgrade to Hybrid Post-Quantum Key Exchange required")
	}

	return report
}

// RunQuickScan - POST /api/v1/scan/quick
func RunQuickScan(c *fiber.Ctx) error {
	var req QuickScanRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	baseDomain := strings.TrimSpace(strings.ToLower(req.Domain))
	baseDomain = strings.TrimPrefix(baseDomain, "https://")
	baseDomain = strings.TrimPrefix(baseDomain, "http://")

	// We only scan the root domain for this highly detailed widget view
	report := PerformDeepTLSScan(baseDomain)

	return c.JSON(report)
}
