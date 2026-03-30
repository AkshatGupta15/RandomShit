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
	ScoreBreakdown    []string  `json:"score_breakdown"` // 🟢 NEW: Mathematical Proof
	LaymanSummary     string    `json:"layman_summary"`
	QKDStatus         string    `json:"qkd_status"`
	HandshakeText     string    `json:"handshake_text"`
	ThreatLevel       int       `json:"threat_level"`
	Readiness         int       `json:"readiness"`
	HardeningRoadmap  []string  `json:"hardening_roadmap"`
	LegacyWeaknesses  []string  `json:"legacy_weaknesses"`
}

const CurveKyber768Draft = tls.CurveID(0x6399)

var kyberPubKeySize = 1184

func PerformDeepTLSScan(hostname string, ip string) EnrichedPQCReport {
	report := EnrichedPQCReport{
		Hostname:         hostname,
		IPAddress:        ip,
		QKDStatus:        "UNAVAILABLE",
		ValidTo:          time.Now(),
		HardeningRoadmap: []string{},
		LegacyWeaknesses: []string{},
		ScoreBreakdown:   []string{},
		CertIssuer:       "Unknown",
	}

	target := fmt.Sprintf("%s:443", hostname)
	if ip != "" {
		target = fmt.Sprintf("%s:443", ip)
	}
	log.Printf("[*] Probing TLS for %s", target)

	config := &tls.Config{
		ServerName: hostname,
		CurvePreferences: []tls.CurveID{
			tls.X25519MLKEM768,
			CurveKyber768Draft,
			tls.X25519,
			tls.CurveP256,
		},
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: true,
	}

	dialer := &net.Dialer{Timeout: 4 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", target, config)

	if err != nil {
		report.DetectedAlgorithm = "OFFLINE"
		report.SecurityScore = 0
		report.LaymanSummary = "We could not connect to this website. It may be offline or blocking our security scanners."
		return report
	}
	defer conn.Close()

	state := conn.ConnectionState()
	report.TLSVersion = tls.VersionName(state.Version)
	report.CipherSuite = tls.CipherSuiteName(state.CipherSuite)

	// 🟢 DETERMINISTIC SCORING ENGINE 🟢
	nistScore := 100
	qDayRisk := 0
	report.ScoreBreakdown = append(report.ScoreBreakdown, "Base NIST Score: 100")

	// 1. Protocol Math
	if report.TLSVersion == "TLS 1.2" || report.TLSVersion == "TLS 1.0" || report.TLSVersion == "TLS 1.1" {
		nistScore -= 15
		qDayRisk += 10
		report.ScoreBreakdown = append(report.ScoreBreakdown, "[-15] Outdated Transport Protocol (TLS 1.2 or lower)")
		report.LegacyWeaknesses = append(report.LegacyWeaknesses, fmt.Sprintf("Using outdated protocol: %s", report.TLSVersion))
	}

	// 2. Certificate Math (Authentication)
	if len(state.PeerCertificates) > 0 {
		cert := state.PeerCertificates[0]
		report.ValidTo = cert.NotAfter
		if len(cert.Issuer.Organization) > 0 {
			report.CertIssuer = cert.Issuer.Organization[0]
		}

		pkAlgo := cert.PublicKeyAlgorithm.String()
		if strings.Contains(pkAlgo, "RSA") || strings.Contains(pkAlgo, "ECDSA") {
			nistScore -= 5 // Small penalty. We want ML-DSA (FIPS 204) for perfect score.
			report.ScoreBreakdown = append(report.ScoreBreakdown, fmt.Sprintf("[-5] Legacy Identity Certificate (%s)", pkAlgo))
			report.LegacyWeaknesses = append(report.LegacyWeaknesses, fmt.Sprintf("Vulnerable Signature Algorithm: %s", pkAlgo))
			report.HardeningRoadmap = append(report.HardeningRoadmap, "Upgrade identity certificates to Post-Quantum ML-DSA (FIPS 204)")
		}
	}

	// 3. Key Exchange Math (Confidentiality & HNDL Risk)
	if state.CurveID == tls.X25519MLKEM768 {
		report.IsPQCEnabled = true
		report.DetectedAlgorithm = "X25519+ML-KEM-768"
		qDayRisk += 5 // Minimum baseline risk
		report.ScoreBreakdown = append(report.ScoreBreakdown, "[+0] Perfect Post-Quantum Key Encapsulation (FIPS 203)")
		report.LaymanSummary = "Excellent security. This website uses military-grade, next-generation encryption. Even a future super-quantum computer cannot break into this connection."
		report.HandshakeText = "NIST FIPS 203 Hybrid Key Encapsulation successfully negotiated."

	} else if state.CurveID == tls.X25519 {
		// Attempt Raw Packet Trap for Draft Kyber
		if probeDraftKyber(hostname, ip) {
			report.IsPQCEnabled = true
			nistScore -= 5
			qDayRisk += 15
			report.DetectedAlgorithm = "Kyber768 (Draft)"
			report.ScoreBreakdown = append(report.ScoreBreakdown, "[-5] Using Draft PQC implementation instead of Final Standard")
			report.LaymanSummary = "Good security. This website is using an early version of quantum-proof encryption. It is safe from quantum attacks, but their IT team needs to update to the final 2024 standard."
			report.HandshakeText = "Draft Kyber (0x6399) detected via packet injection."
			report.HardeningRoadmap = append(report.HardeningRoadmap, "Update from Kyber Draft to Final ML-KEM-768")
		} else {
			report.IsPQCEnabled = false
			nistScore -= 35
			qDayRisk += 65
			report.DetectedAlgorithm = "X25519 (Standard ECC)"
			report.ScoreBreakdown = append(report.ScoreBreakdown, "[-35] Highly Vulnerable Classical Key Exchange (No PQC)")
			report.LaymanSummary = "Warning: This website uses standard encryption. While safe today, foreign hackers could be recording this data right now to easily decrypt it when quantum computers are built in a few years (Harvest Now, Decrypt Later)."
			report.HandshakeText = "Standard Elliptic Curve negotiated. Mathematically vulnerable to Shor's Algorithm."
			report.HardeningRoadmap = append(report.HardeningRoadmap, "Enable FIPS 203 Post-Quantum Key Exchange immediately")
		}
	} else {
		report.IsPQCEnabled = false
		nistScore -= 50
		qDayRisk += 95
		report.DetectedAlgorithm = fmt.Sprintf("Legacy (%s)", tls.CurveID(state.CurveID).String())
		report.ScoreBreakdown = append(report.ScoreBreakdown, "[-50] Deprecated Legacy Key Exchange")
		report.LaymanSummary = "Critical Risk: This website is using severely outdated security. It is highly vulnerable to modern attacks and completely defenseless against future quantum threats."
		report.HandshakeText = fmt.Sprintf("Legacy %s cipher negotiated. Deprecated by modern standards.", report.CipherSuite)
		report.HardeningRoadmap = append(report.HardeningRoadmap, "Emergency upgrade to modern TLS 1.3 and Hybrid PQC")
	}

	// Calculate Final
	if nistScore < 0 {
		nistScore = 0
	}
	if qDayRisk > 100 {
		qDayRisk = 100
	}

	report.SecurityScore = nistScore
	report.QDayRisk = qDayRisk
	report.ThreatLevel = qDayRisk
	report.Readiness = nistScore

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
