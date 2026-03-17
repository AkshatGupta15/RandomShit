package models

import (
	"time"
)

// Service represents an open port or web application running on a Subdomain
type Service struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	SubdomainID uint   `gorm:"index;not null" json:"subdomain_id"`
	
	Port        int    `gorm:"not null" json:"port"`       // e.g., 80, 443, 8443
	Protocol    string `gorm:"default:'tcp'" json:"protocol"`
	
	// HTTP Probe Data
	WebTech     string `json:"web_tech"`    // e.g., Nginx, IIS/10.0
	StatusCode  int    `json:"status_code"` // e.g., 200, 302
	PageTitle   string `json:"page_title"`  // e.g., "PNB Net Banking"
	
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}