package models

import (
	"time"
	"gorm.io/gorm"
)

// Asset maps exactly to the database table and the React frontend requirements
type Asset struct {
	ID                   uint           `gorm:"primaryKey" json:"id"`
	RootDomain           string         `gorm:"index" json:"rootDomain"` // e.g., pnbindia.in
	AssetName            string         `gorm:"uniqueIndex" json:"assetName"` // e.g., api.pnbindia.in
	URL                  string         `json:"url"`
	IPv4                 string         `json:"ipv4"`
	Type                 string         `json:"type"`
	CertStatus           string         `json:"certStatus"`
	KeyLength            string         `json:"keyLength"`
	CipherSuite          string         `json:"cipherSuite"`
	TLSVersion           string         `json:"tlsVersion"`
	CertificateAuthority string         `json:"certificateAuthority"`
	CreatedAt            time.Time      `json:"createdAt"`
	UpdatedAt            time.Time      `json:"updatedAt"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}