// backend/internal/core/scanner/tls_probe.go
package scanner

import (
	"crypto/tls"
	"crypto/x509"
	"net"
	"time"
)

// ScannedCryptoAsset represents the detailed cryptographic posture
type ScannedCryptoAsset struct {
	AssetName            string `json:"assetName"`
	IPv4                 string `json:"ipv4"`
	CertStatus           string `json:"certStatus"`
	KeyLength            string `json:"keyLength"`
	CipherSuite          string `json:"cipherSuite"`
	TLSVersion           string `json:"tlsVersion"`
	CertificateAuthority string `json:"certificateAuthority"`
}

func getTLSVersionString(v uint16) string {
	switch v {
	case tls.VersionTLS10: return "TLS 1.0"
	case tls.VersionTLS11: return "TLS 1.1"
	case tls.VersionTLS12: return "TLS 1.2"
	case tls.VersionTLS13: return "TLS 1.3"
	default: return "Unknown"
	}
}

func getCertStatus(expiry time.Time) string {
	daysLeft := time.Until(expiry).Hours() / 24
	if daysLeft < 0 {
		return "Expired"
	} else if daysLeft < 30 {
		return "Expiring"
	}
	return "Valid"
}

// ProbeTLS strictly returns cryptographic data if the endpoint speaks TLS
func ProbeTLS(domain string, ip string) *ScannedCryptoAsset {
	dialer := &net.Dialer{Timeout: 4 * time.Second}
	config := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         domain, // SNI routing
		MinVersion:         tls.VersionTLS10,
	}

	conn, err := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(ip, "443"), config)
	if err != nil {
		return nil // Port 443 closed or not TLS
	}
	defer conn.Close()

	state := conn.ConnectionState()
	if len(state.PeerCertificates) == 0 {
		return nil
	}

	cert := state.PeerCertificates[0]

	issuer := "Unknown"
	if len(cert.Issuer.Organization) > 0 {
		issuer = cert.Issuer.Organization[0]
	}

	keyAlgo := "Unknown"
	switch cert.PublicKeyAlgorithm {
	case x509.RSA: keyAlgo = "RSA"
	case x509.ECDSA: keyAlgo = "ECDSA"
	case x509.Ed25519: keyAlgo = "Ed25519"
	}

	return &ScannedCryptoAsset{
		AssetName:            domain,
		IPv4:                 ip,
		CertStatus:           getCertStatus(cert.NotAfter),
		KeyLength:            keyAlgo,
		CipherSuite:          tls.CipherSuiteName(state.CipherSuite),
		TLSVersion:           getTLSVersionString(state.Version),
		CertificateAuthority: issuer,
	}
}