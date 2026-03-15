package db

import (
	"log"
	"quantum-scanner/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDatabase(dsn string) {
	var err error
	// DSN format: "host=db.supabase.co user=postgres password=YOUR_PASS dbname=postgres port=5432 sslmode=require"
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to the database:", err)
	}

	log.Println("Successfully connected to PostgreSQL!")

	// Auto-Migrate creates the tables if they don't exist
	err = DB.AutoMigrate(&models.Asset{})
	if err != nil {
		log.Fatal("Failed to migrate database schemas:", err)
	}
	
	log.Println(" Database schemas migrated.")
}