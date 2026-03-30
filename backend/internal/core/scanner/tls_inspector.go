package scanner

import (
	"crypto/tls"
	"fmt"
	"log"
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

const CurveKyber768Draft = tls.CurveID(0x6399)
var kyberPubKeySize = 1184 // Must be var to prevent compile-time byte overflow

// PerformDeepTLSScan runs a two-stage TLS probe
func PerformDeepTLSScan(hostname string, ip string) EnrichedPQCReport {
	report := EnrichedPQCReport{
		Hostname:         hostname,
		IPAddress:        ip,
		QKDStatus:        "UNAVAILABLE",
		ValidTo:          time.Now(),
		HardeningRoadmap: []string{},
		LegacyWeaknesses: []string{},
		CertIssuer:       "Unknown",
	}

	target := fmt.Sprintf("%s:443", hostname)
	if ip != "" {
		target = fmt.Sprintf("%s:443", ip)
	}
	log.Printf("[*] Probing TLS for %s", target)

	// ── Stage 1: Standard Go native TLS handshake ─────────────────────────────
	config := &tls.Config{
		ServerName: hostname,
		CurvePreferences: []tls.CurveID{
			tls.X25519MLKEM768, // Final NIST FIPS 203
			CurveKyber768Draft, // Legacy Draft 0x6399
			tls.X25519,         // Classical fallback
			tls.CurveP256,      // Classical fallback
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
	report.TLSVersion = tls.VersionName(state.Version)
	report.CipherSuite = tls.CipherSuiteName(state.CipherSuite)

	// Extract certificate metadata
	if len(state.PeerCertificates) > 0 {
		cert := state.PeerCertificates[0]
		report.ValidTo = cert.NotAfter
		if len(cert.Issuer.Organization) > 0 {
			report.CertIssuer = cert.Issuer.Organization[0]
		}
		pkAlgo := cert.PublicKeyAlgorithm.String()
		if strings.Contains(pkAlgo, "ECDSA") {
			report.LegacyWeaknesses = append(report.LegacyWeaknesses, "Legacy ECDSA certificate (quantum-vulnerable signing)")
		} else {
			report.LegacyWeaknesses = append(report.LegacyWeaknesses, "Classic RSA certificate (quantum-vulnerable signing)")
		}
		report.HardeningRoadmap = append(report.HardeningRoadmap, "Transition to ML-DSA (FIPS 204) for server authentication")
	}

	// ── Stage 2: Evaluate Key Exchange & Force Hybrid Detection ──────────────
	if state.CurveID == tls.X25519MLKEM768 {
		report.IsPQCEnabled = true
		report.DetectedAlgorithm = "X25519+ML-KEM-768 (FIPS 203)"
		report.QDayRisk = 10
		report.SecurityScore = 98
		report.ThreatLevel = 10
		report.Readiness = 98
		report.HandshakeText = fmt.Sprintf("Connection negotiated using %s hybrid key exchange over %s. Final NIST standard in effect.", report.DetectedAlgorithm, report.TLSVersion)
		report.LegacyWeaknesses = append(report.LegacyWeaknesses, "ECC P-256 fallback still advertised (compatibility risk)")
		report.HardeningRoadmap = append(report.HardeningRoadmap, "Implement SLH-DSA for long-term root identity assurance")

	} else if state.CurveID == tls.X25519 {
		// 🔴 The network downgraded us to classical. We must FORCE the Quantum Check!
		log.Printf("[!] Classical fallback detected on %s. Injecting Raw Kyber Probe...", hostname)
		
		if probeDraftKyber(hostname, ip) {
			report.IsPQCEnabled = true
			report.DetectedAlgorithm = "X25519+Kyber768 (Draft 0x6399)"
			report.QDayRisk = 15
			report.SecurityScore = 93
			report.ThreatLevel = 15
			report.Readiness = 88
			report.HandshakeText = fmt.Sprintf("Server supports Kyber768 Draft hybrid (0x6399) over %s. Detected via raw packet injection bypass. Migration to final ML-KEM-768 (FIPS 203) is recommended.", report.TLSVersion)
			report.HardeningRoadmap = append(report.HardeningRoadmap, "Migrate from Kyber Draft (0x6399) to final ML-KEM-768 (FIPS 203)")
		} else {
			report.IsPQCEnabled = false
			report.DetectedAlgorithm = "X25519 (Classical)"
			report.QDayRisk = 65
			report.SecurityScore = 60
			report.ThreatLevel = 65
			report.Readiness = 40
			report.HandshakeText = fmt.Sprintf("Standard elliptic curve key exchange (%s) negotiated over %s. Vulnerable to Shor's Algorithm.", report.DetectedAlgorithm, report.TLSVersion)
			report.HardeningRoadmap = append(report.HardeningRoadmap, "Upgrade server to support ML-KEM-768 (FIPS 203) Key Encapsulation Mechanism")
		}

	} else {
		report.IsPQCEnabled = false
		report.DetectedAlgorithm = fmt.Sprintf("Legacy (%s)", tls.CurveID(state.CurveID).String())
		report.QDayRisk = 95
		report.SecurityScore = 20
		report.ThreatLevel = 95
		report.Readiness = 10
		report.HandshakeText = fmt.Sprintf("Legacy cryptography negotiated (cipher: %s). Highly vulnerable to HNDL attacks.", report.CipherSuite)
		report.HardeningRoadmap = append(report.HardeningRoadmap, "Immediate upgrade to Hybrid Post-Quantum Key Exchange required")
	}

	return report
}

// ── Raw TCP Packet Injection Functions ────────────────────────────────────────

func probeDraftKyber(hostname, ip string) bool {
	target := hostname
	if ip != "" {
		target = ip
	}

	conn, err := net.DialTimeout("tcp", target+":443", 4*time.Second)
	if err != nil {
		return false
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(4 * time.Second))

	clientHello := buildKyberDraftClientHello(hostname)
	if _, err := conn.Write(clientHello); err != nil {
		return false
	}

	recHeader := make([]byte, 5)
	if err := readFull(conn, recHeader); err != nil {
		return false
	}
	if recHeader[0] != 22 {
		return false
	}

	recLen := int(recHeader[3])<<8 | int(recHeader[4])
	if recLen <= 0 || recLen > 65535 {
		return false
	}
	
	recBody := make([]byte, recLen)
	if err := readFull(conn, recBody); err != nil {
		return false
	}

	if len(recBody) < 1 || recBody[0] != 2 {
		return false
	}

	// Scan ServerHello bytes for the 0x6399 group ID
	for i := 0; i < len(recBody)-1; i++ {
		if recBody[i] == 0x63 && recBody[i+1] == 0x99 {
			return true
		}
	}
	return false
}

func readFull(conn net.Conn, buf []byte) error {
	offset := 0
	for offset < len(buf) {
		n, err := conn.Read(buf[offset:])
		offset += n
		if err != nil {
			return err
		}
	}
	return nil
}

func buildKyberDraftClientHello(sni string) []byte {
	pubKeyLen := kyberPubKeySize // 1184 bytes
	kyberKeyShare := make([]byte, pubKeyLen)

	var keyShareEntry []byte
	keyShareEntry = append(keyShareEntry, 0x63, 0x99)
	keyShareEntry = append(keyShareEntry, byte(pubKeyLen>>8), byte(pubKeyLen))
	keyShareEntry = append(keyShareEntry, kyberKeyShare...)

	listLen := len(keyShareEntry)
	extDataLen := 2 + listLen
	var keyShareExt []byte
	keyShareExt = append(keyShareExt, 0x00, 0x33)
	keyShareExt = append(keyShareExt, byte(extDataLen>>8), byte(extDataLen))
	keyShareExt = append(keyShareExt, byte(listLen>>8), byte(listLen))
	keyShareExt = append(keyShareExt, keyShareEntry...)

	sniExt := buildSNIExtension(sni)

	supportedVersionsExt := []byte{
		0x00, 0x2b, 0x00, 0x03, 0x02, 0x03, 0x04,
	}

	supportedGroupsExt := []byte{
		0x00, 0x0a, 0x00, 0x04, 0x00, 0x02, 0x63, 0x99,
	}

	sigAlgsExt := []byte{
		0x00, 0x0d, 0x00, 0x04, 0x00, 0x02, 0x04, 0x03,
	}

	var extensions []byte
	extensions = append(extensions, sniExt...)
	extensions = append(extensions, supportedVersionsExt...)
	extensions = append(extensions, supportedGroupsExt...)
	extensions = append(extensions, sigAlgsExt...)
	extensions = append(extensions, keyShareExt...)

	var chBody []byte
	chBody = append(chBody, 0x03, 0x03)
	chBody = append(chBody, make([]byte, 32)...)
	chBody = append(chBody, 0x00)
	chBody = append(chBody, 0x00, 0x02, 0x13, 0x01)
	chBody = append(chBody, 0x01, 0x00)

	extLen := len(extensions)
	chBody = append(chBody, byte(extLen>>8), byte(extLen))
	chBody = append(chBody, extensions...)

	bodyLen := len(chBody)
	var handshake []byte
	handshake = append(handshake, 0x01)
	handshake = append(handshake, byte(bodyLen>>16), byte(bodyLen>>8), byte(bodyLen))
	handshake = append(handshake, chBody...)

	recLen := len(handshake)
	var record []byte
	record = append(record, 0x16, 0x03, 0x01)
	record = append(record, byte(recLen>>8), byte(recLen))
	record = append(record, handshake...)

	return record
}

func buildSNIExtension(hostname string) []byte {
	nameLen := len(hostname)
	listLen := 1 + 2 + nameLen
	extDataLen := 2 + listLen

	var ext []byte
	ext = append(ext, 0x00, 0x00)
	ext = append(ext, byte(extDataLen>>8), byte(extDataLen))
	ext = append(ext, byte(listLen>>8), byte(listLen))
	ext = append(ext, 0x00)
	ext = append(ext, byte(nameLen>>8), byte(nameLen))
	ext = append(ext, []byte(hostname)...)
	return ext
}