package models

import (
	"time"
)

type Domain struct {
	ID               uint        `gorm:"primaryKey" json:"id"`
	DomainName       string      `gorm:"unique;not null" json:"domain_name"`
	Status           string      `json:"status"`
	RiskLevel        string      `json:"risk_level"` // e.g., "Critical", "Moderate", "Safe"
	TotalAssets      int         `json:"total_assets"`
	ScannedAssets    int         `json:"scanned_assets"`
	Endpoints        int         `json:"endpoints"`
	CompanyName      string      `json:"company_name"`
	Registrar        string      `json:"registrar"`
	RegistrationDate string      `json:"registration_date"`
	DetectionDate    time.Time   `json:"detection_date"`
	LastScanned      *time.Time  `json:"last_scanned"`
	Subdomains       []Subdomain `json:"Subdomains,omitempty" gorm:"foreignKey:DomainID"`
}
