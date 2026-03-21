// cmd/api/main.go
package main

import (
	"log"
	"os"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/api"
	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	// Load environment variables from repository root .env (supports backend/ root structure)
	err := godotenv.Load("../.env")
	if err != nil {
		log.Println("Warning: .env not found, falling back to actual environment values")
	}

	// 1. Connect DB
	// Allow DATABASE_URL from env if specified
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://postgres:password@localhost:5432/postgres?sslmode=disable"
	}
	db.ConnectDatabase(databaseURL)
	seedAdminUser()

	// 2. Setup Fiber
	app := fiber.New()
	app.Use(logger.New())
	// app.Use(cors.New(cors.Config{AllowOrigins: "http://localhost:3000"}))
	app.Use(cors.New(cors.Config{
		// AllowOrigins:     "http://localhost:3000",
		AllowOrigins:     "http://localhost:3000,https://your-app.pages.dev",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
	}))

	// 3. Register ALL Routes perfectly
	api.SetupRoutes(app)

	// 4. Listen
	log.Fatal(app.Listen(":8080"))
}
func seedAdminUser() {
	var admin models.User
	result := db.DB.Where("username = ?", "admin").First(&admin)

	if result.Error != nil {
		// No admin user – create one
		hashed, err := bcrypt.GenerateFromPassword([]byte("Admin@123"), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Failed to hash admin password: %v", err)
			return
		}
		admin = models.User{
			Username:     "admin",
			PasswordHash: string(hashed),
			Role:         "admin",
		}
		if err := db.DB.Create(&admin).Error; err != nil {
			log.Printf("Failed to create admin user: %v", err)
		} else {
			log.Println("Created default admin user (username: admin, password: Admin@123)")
		}
	} else {
		// Admin exists – optionally update the password to a known one
		// This is useful if you want to force a known password
		newHash, err := bcrypt.GenerateFromPassword([]byte("Admin@123"), bcrypt.DefaultCost)
		if err == nil {
			admin.PasswordHash = string(newHash)
			admin.UpdatedAt = time.Now()
			if err := db.DB.Save(&admin).Error; err == nil {
				log.Println("Updated admin password to Admin@123")
			}
		}
	}
}
