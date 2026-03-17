package models

import (
	"time"
)

// SSLCertificate represents the extracted TLS/Crypto data for a secure service
type SSLCertificate struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SubdomainID uint      `gorm:"uniqueIndex;not null" json:"subdomain_id"` // 1-to-1 relationship with Subdomain
	
	Issuer      string    `json:"issuer"`
	ValidFrom   time.Time `json:"valid_from"`
	ValidTo     time.Time `json:"valid_to"`
	
	TLSVersion  string    `gorm:"index" json:"tls_version"`  // e.g., TLS 1.2, TLS 1.3
	CipherSuite string    `json:"cipher_suite"`
	KeyLength   string    `json:"key_length"`                // e.g., RSA-2048, Kyber768
	
	PQCTier     string    `gorm:"index" json:"pqc_tier"`     // e.g., Elite, Standard, Legacy
	
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}