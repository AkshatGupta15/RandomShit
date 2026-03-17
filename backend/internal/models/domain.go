package models

import (
	"time"
	"gorm.io/gorm"
)

type Domain struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	DomainName    string         `gorm:"uniqueIndex;not null" json:"domain_name"`
	Status        string         `gorm:"default:'pending'" json:"status"` // pending, scanning, completed, halted, failed
	
	// Progress Tracking Fields
	TotalAssets   int            `gorm:"default:0" json:"total_assets"`
	ScannedAssets int            `gorm:"default:0" json:"scanned_assets"`
	
	LastScanned   time.Time      `json:"last_scanned"`
	Subdomains    []Subdomain    `gorm:"foreignKey:DomainID;constraint:OnDelete:CASCADE;" json:"subdomains,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}