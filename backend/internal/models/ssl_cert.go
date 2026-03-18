package models

import (
	"time"
)

type SSLCertificate struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SubdomainID uint      `gorm:"uniqueIndex;not null" json:"subdomain_id"`
	
	// ⬇️ ADD THIS HERE AS WELL ⬇️
	Subdomain   *Subdomain `gorm:"foreignKey:SubdomainID" json:"subdomain,omitempty"`
	
	Issuer      string    `json:"issuer"`
	ValidFrom   time.Time `json:"valid_from"`
	ValidTo     time.Time `json:"valid_to"`
	
	TLSVersion  string    `gorm:"index" json:"tls_version"`
	CipherSuite string    `json:"cipher_suite"`
	KeyLength   string    `json:"key_length"`
	
	PQCTier     string    `gorm:"index" json:"pqc_tier"`
	
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}