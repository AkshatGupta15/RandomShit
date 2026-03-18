package models

import (
	"time"
)

// SystemSetting stores the dynamic configuration for the Go Scanner Engine
// We will enforce that only ONE row ever exists in this table (ID = 1)
type SystemSetting struct {
	ID                   uint      `gorm:"primaryKey" json:"id"`
	MaxConcurrentWorkers int       `gorm:"default:20" json:"max_concurrent_workers"` // Governs the Goroutine Semaphore
	TimeoutSeconds       int       `gorm:"default:15" json:"timeout_seconds"`        // Governs HTTP Client timeouts
	
	// Toggle Switches for OSINT APIs
	EnableCertSpotter    bool      `gorm:"default:true" json:"enable_cert_spotter"`
	EnableHackerTarget   bool      `gorm:"default:true" json:"enable_hacker_target"`
	EnableAlienVault     bool      `gorm:"default:true" json:"enable_alien_vault"`
	
	UpdatedAt            time.Time `json:"updated_at"`
}