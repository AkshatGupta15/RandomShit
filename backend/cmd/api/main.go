// cmd/api/main.go
package main

import (
	"log"
	"os"

	"github.com/AkshatGupta15/RandomShit/backend/internal/api"
	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/joho/godotenv"

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
