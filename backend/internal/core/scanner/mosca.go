package scanner

import (
	"strings"
	"time"
)

// Weights based on the Python Q-ARMOR algorithm
var weights = map[string]float64{
	"kex":       25.0,
	"cert":      20.0,
	"signature": 10.0,
	"tls":       10.0,
	"cipher":    10.0,
	"key_size":  10.0,
	"hash":      5.0,
	"chain":     5.0,
	"expiry":    5.0,
}

// CRQCLikelyBreak maps algorithms to their "Likely Break" year
var crqcLikelyBreak = map[string]int{
	"RSA-2048":  2033,
	"RSA-4096":  2037,
	"ECDSA-256": 2032,
	"ECDHE":     2032,
	"X25519":    2032,
	"RSA":       2033, // Generic fallback
}

var pqcAlgorithms = []string{"ML-KEM", "KYBER", "ML-DSA", "DILITHIUM", "SLH-DSA", "SPHINCS+", "FALCON"}

// 1. Mosca's Theorem: X + Y > Z
func CalculateMoscaRisk(algo string, dataLifetimeYears int, migrationTime int) float64 {
	algo = strings.ToUpper(algo)
	now := time.Now().Year()

	matchedAlgo := ""
	for key := range crqcLikelyBreak {
		if strings.Contains(algo, key) {
			matchedAlgo = key
			break
		}
	}

	if matchedAlgo == "" {
		return 0.0 // PQC safe or unknown
	}

	yearsToBreak := crqcLikelyBreak[matchedAlgo] - now

	// Mosca inequality: (X + Y) > Z
	if (dataLifetimeYears + migrationTime) > yearsToBreak {
		return 1.0
	} else if dataLifetimeYears > (yearsToBreak / 2) {
		return 0.5
	}
	return 0.0
}

// 2. Q-Score Calculation
func ComputeFinalRisk(tlsVersion, cipherSuite, keyLength string, validTo time.Time) (int, string) {
	tlsVersion = strings.ToUpper(tlsVersion)
	cipherSuite = strings.ToUpper(cipherSuite)
	keyLength = strings.ToUpper(keyLength)

	// Base Scores
	scoreTLS := 0.1
	if strings.Contains(tlsVersion, "1.3") {
		scoreTLS = 1.0
	} else if strings.Contains(tlsVersion, "1.2") {
		scoreTLS = 0.5
	}

	scoreKex := 0.3
	for _, p := range pqcAlgorithms {
		if strings.Contains(keyLength, p) || strings.Contains(cipherSuite, p) {
			scoreKex = 1.0
			break
		}
	}
	if scoreKex < 1.0 {
		if strings.Contains(keyLength, "ECDHE") || strings.Contains(keyLength, "X25519") {
			scoreKex = 0.2
		}
	}

	scoreCipher := 0.5
	if strings.Contains(cipherSuite, "256") {
		scoreCipher = 1.0
	} else if strings.Contains(cipherSuite, "128") {
		scoreCipher = 0.6
	}

	daysToExpiry := time.Until(validTo).Hours() / 24
	scoreExpiry := 1.0
	if daysToExpiry < 0 {
		scoreExpiry = 0.0
	} else if daysToExpiry < 30 {
		scoreExpiry = 0.3
	}

	// Calculate weighted total (Normalizing since we don't have all Python parameters from standard Go TLS)
	// We distribute the missing weights proportionally or assume defaults.
	qScore := (weights["tls"] * scoreTLS) +
		(weights["kex"] * scoreKex) +
		(weights["cipher"] * scoreCipher) +
		(weights["expiry"] * scoreExpiry) +
		(weights["cert"] * scoreKex) + // Approximating cert strength to KEX strength
		(weights["key_size"] * scoreKex) + // Approximating key size to KEX strength
		(weights["hash"] * scoreCipher) + // Approximating hash to cipher strength
		(weights["chain"] * 1.0) + // Assume valid chain
		(weights["signature"] * scoreKex)

	// Apply Mosca Penalty (Defaulting to High-Risk Data: X=10, Y=3)
	moscaPenalty := CalculateMoscaRisk(keyLength, 10, 3)
	finalScore := qScore - (20.0 * moscaPenalty)

	if finalScore > 100 {
		finalScore = 100
	}
	if finalScore < 0 {
		finalScore = 0
	}

	// Determine Label
	label := "CRITICAL"
	if finalScore >= 80 {
		label = "FULLY_QUANTUM_SAFE"
	} else if finalScore >= 60 {
		label = "PQC_READY"
	} else if finalScore >= 40 {
		label = "NOT_PQC_READY"
	}

	return int(finalScore), label
}
