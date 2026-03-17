package db

import (
	"log"
	"quantum-scanner/internal/models"
	
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func ConnectDatabase(dsn string) {
	var err error
	
	// Configure GORM to log SQL queries during development
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatal("Failed to connect to the database:", err)
	}

	log.Println("✅ Successfully connected to PostgreSQL")

	// AutoMigrate will safely create/update the tables based on your structs
	err = DB.AutoMigrate(
		&models.Domain{},
		&models.Subdomain{},
		&models.Service{},
		&models.SSLCertificate{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database schemas:", err)
	}
	
	log.Println("✅ Enterprise ASM Schemas Migrated Successfully")
}