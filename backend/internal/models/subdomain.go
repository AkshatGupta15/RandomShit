package models

import (
	"time"
)

// Subdomain represents a discovered endpoint under a root Domain
type Subdomain struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	DomainID  uint   `gorm:"index;not null" json:"domain_id"`
	Hostname  string `gorm:"uniqueIndex;not null" json:"hostname"` // e.g., api.pnbindia.in
	IPAddress string `gorm:"index" json:"ip_address"`
	IsAlive   bool   `gorm:"default:false" json:"is_alive"`

	// Relationships
	Services []Service       `gorm:"foreignKey:SubdomainID;constraint:OnDelete:CASCADE;" json:"services,omitempty"`
	SSLCert  *SSLCertificate `gorm:"foreignKey:SubdomainID;constraint:OnDelete:CASCADE;" json:"ssl_cert,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
