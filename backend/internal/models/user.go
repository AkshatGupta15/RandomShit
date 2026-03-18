package models

import "time"

// User represents an admin accessing the Q-ARMOR dashboard
type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash string    `json:"-"` // The "-" ensures the password hash is NEVER sent to the React frontend
	Role         string    `gorm:"default:'admin'" json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}