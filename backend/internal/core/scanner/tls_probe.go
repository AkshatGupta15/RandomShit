package scanner

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
)

// determinePQCTier grades the Post-Quantum Cryptography readiness
func determinePQCTier(tlsVersion uint16) string {
	switch tlsVersion {
	case tls.VersionTLS13:
		return "Elite" // TLS 1.3 supports Post-Quantum Key Encapsulation (Kyber)
	case tls.VersionTLS12:
		return "Standard"
	default:
		return "Legacy" // TLS 1.1 or 1.0
	}
}

// getKeyInfo returns a string like "RSA-2048", "ECDSA-256", "Ed25519"
func getKeyInfo(cert *x509.Certificate) string {
	switch pub := cert.PublicKey.(type) {
	case *rsa.PublicKey:
		return fmt.Sprintf("RSA-%d", pub.N.BitLen())
	case *ecdsa.PublicKey:
		return fmt.Sprintf("ECDSA-%d", pub.Curve.Params().BitSize)
	case ed25519.PublicKey:
		return "Ed25519"
	default:
		return "Unknown"
	}
}

// ProbeTLS connects to the asset and extracts cryptographic details directly into the DB model
func ProbeTLS(domain string, ip string) *models.SSLCertificate {
	dialer := &net.Dialer{Timeout: 4 * time.Second}
	config := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         domain,
		MinVersion:         tls.VersionTLS10,
	}

	conn, err := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(ip, "443"), config)
	if err != nil {
		return nil
	}
	defer conn.Close()

	state := conn.ConnectionState()
	if len(state.PeerCertificates) == 0 {
		return nil
	}
	cert := state.PeerCertificates[0]

	// Extract issuer
	issuer := "Unknown"
	if len(cert.Issuer.Organization) > 0 {
		issuer = cert.Issuer.Organization[0]
	}

	// Get key info
	keyInfo := getKeyInfo(cert)

	// Get TLS version string
	tlsVersionStr := tls.VersionName(state.Version)

	// Get cipher suite name
	cipherSuiteName := tls.CipherSuiteName(state.CipherSuite)

	// Calculate Mosca Q‑Score and risk label
	qScore, riskLabel := ComputeFinalRisk(
		tlsVersionStr,
		cipherSuiteName,
		keyInfo,
		cert.NotAfter,
	)

	// Build the certificate model
	return &models.SSLCertificate{
		Issuer:      issuer,
		ValidFrom:   cert.NotBefore,
		ValidTo:     cert.NotAfter,
		TLSVersion:  tlsVersionStr,
		CipherSuite: cipherSuiteName,
		KeyLength:   keyInfo,
		PQCTier:     determinePQCTier(state.Version),
		QScore:      qScore,
		RiskLabel:   riskLabel,
	}
}
