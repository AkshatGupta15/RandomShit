package scanner

import (
	"crypto/tls"
	"crypto/x509"
	"net"
	"time"

	// IMPORTANT: Update this import path to match your go.mod module name
	// If your go.mod says "module pnb-hackathon", change this to "pnb-hackathon/internal/models"
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

// ProbeTLS connects to the asset and extracts cryptographic details directly into the DB model
func ProbeTLS(domain string, ip string) *models.SSLCertificate {
	dialer := &net.Dialer{Timeout: 4 * time.Second}
	config := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         domain, // SNI routing to bypass modern firewalls
		MinVersion:         tls.VersionTLS10,
	}

	conn, err := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(ip, "443"), config)
	if err != nil {
		return nil // Port 443 is likely closed or not serving HTTPS
	}
	defer conn.Close()

	state := conn.ConnectionState()
	if len(state.PeerCertificates) == 0 {
		return nil
	}

	cert := state.PeerCertificates[0]

	// Extract details
	issuer := "Unknown"
	if len(cert.Issuer.Organization) > 0 {
		issuer = cert.Issuer.Organization[0]
	}

	// Determine public key type
	keyAlgo := "Unknown"
	switch cert.PublicKeyAlgorithm {
	case x509.RSA:
		keyAlgo = "RSA"
	case x509.ECDSA:
		keyAlgo = "ECDSA"
	case x509.Ed25519:
		keyAlgo = "Ed25519"
	}

	// Return the GORM Database Model directly
	return &models.SSLCertificate{
		Issuer:      issuer,
		ValidFrom:   cert.NotBefore,
		ValidTo:     cert.NotAfter,
		TLSVersion:  tls.VersionName(state.Version), // Go 1.21+ native version mapping
		CipherSuite: tls.CipherSuiteName(state.CipherSuite),
		KeyLength:   keyAlgo,
		PQCTier:     determinePQCTier(state.Version),
	}
}
