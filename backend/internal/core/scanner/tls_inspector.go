package scanner

import (
	"crypto/tls"
	"fmt"
	"net"
	"strings"
	"time"
)

type EnrichedPQCReport struct {
	Hostname          string    `json:"hostname"`
	IPAddress         string    `json:"ip_address"`
	IsPQCEnabled      bool      `json:"is_pqc_enabled"`
	DetectedAlgorithm string    `json:"detected_algorithm"`
	TLSVersion        string    `json:"tls_version"`
	CipherSuite       string    `json:"cipher_suite"`
	CertIssuer        string    `json:"cert_issuer"`
	ValidTo           time.Time `json:"valid_to"`
	QDayRisk          int       `json:"q_day_risk"`
	SecurityScore     int       `json:"security_score"`
	QKDStatus         string    `json:"qkd_status"`
	HandshakeText     string    `json:"handshake_text"`
	ThreatLevel       int       `json:"threat_level"`
	Readiness         int       `json:"readiness"`
	HardeningRoadmap  []string  `json:"hardening_roadmap"`
	LegacyWeaknesses  []string  `json:"legacy_weaknesses"`
}

// PerformDeepTLSScan conducts a pure, unbiased TLS handshake to extract primitives
func PerformDeepTLSScan(hostname string, ip string) EnrichedPQCReport {
	report := EnrichedPQCReport{
		Hostname:  hostname,
		IPAddress: ip,
		QKDStatus: "UNAVAILABLE",
		ValidTo:   time.Now(),
	}

	target := fmt.Sprintf("%s:443", hostname)
	if ip != "" {
		target = fmt.Sprintf("%s:443", ip)
	}

	// 1. Configure pure TLS Client Hello requesting ML-KEM
	config := &tls.Config{
		ServerName: hostname,
		CurvePreferences: []tls.CurveID{
			tls.X25519MLKEM768, // Official NIST FIPS 203 Hybrid (Go 1.24+)
			tls.X25519,         // Classical Fallback
			tls.CurveP256,      // Classical Fallback
		},
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: true,
	}

	dialer := &net.Dialer{Timeout: 4 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", target, config)

	if err != nil {
		report.DetectedAlgorithm = "OFFLINE"
		report.HandshakeText = "Could not establish a TLS connection. Host may be offline or blocking probes."
		report.SecurityScore = 0
		report.ThreatLevel = 100
		return report
	}
	defer conn.Close()

	state := conn.ConnectionState()

	// 2. Extract standard TLS data
	report.TLSVersion = tls.VersionName(state.Version)
	report.CipherSuite = tls.CipherSuiteName(state.CipherSuite)

	report.HardeningRoadmap = []string{}
	report.LegacyWeaknesses = []string{}
	report.CertIssuer = "Unknown"

	if len(state.PeerCertificates) > 0 {
		cert := state.PeerCertificates[0]
		report.ValidTo = cert.NotAfter
		if len(cert.Issuer.Organization) > 0 {
			report.CertIssuer = cert.Issuer.Organization[0]
		}

		pkAlgo := cert.PublicKeyAlgorithm.String()
		if strings.Contains(pkAlgo, "ECDSA") {
			report.LegacyWeaknesses = append(report.LegacyWeaknesses, "Legacy ECDSA certificates")
			report.HardeningRoadmap = append(report.HardeningRoadmap, "Transition to ML-DSA (FIPS 204) for server authentication")
		} else {
			report.LegacyWeaknesses = append(report.LegacyWeaknesses, "Classic RSA certificates")
			report.HardeningRoadmap = append(report.HardeningRoadmap, "Transition to ML-DSA (FIPS 204) for server authentication")
		}
	}

	// 3. Categorize Key Exchange purely based on Server Response
	if state.CurveID == tls.X25519MLKEM768 {
		report.IsPQCEnabled = true
		report.DetectedAlgorithm = "X25519+ML-KEM-768"
		report.QDayRisk = 15
		report.SecurityScore = 98
		report.ThreatLevel = 15
		report.Readiness = 98
		report.HandshakeText = fmt.Sprintf("Connection successfully negotiated using %s hybrid key exchange over %s.", report.DetectedAlgorithm, report.TLSVersion)
		report.LegacyWeaknesses = append(report.LegacyWeaknesses, "ECC P-256 fallback compatibility")
		report.HardeningRoadmap = append(report.HardeningRoadmap, "Implementation of SLH-DSA for long-term root identity")

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
		report.HandshakeText = fmt.Sprintf("Legacy cryptography negotiated (%s). Highly vulnerable to HNDL attacks.", report.CipherSuite)
		report.HardeningRoadmap = append(report.HardeningRoadmap, "Immediate upgrade to Hybrid Post-Quantum Key Exchange required")
	}

	return report
}
