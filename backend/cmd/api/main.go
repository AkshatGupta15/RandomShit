// cmd/api/main.go
package main

import (
	"log"
	"quantum-scanner/internal/api" // Import your new api package
	"quantum-scanner/internal/db"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	// 1. Connect DB
	db.ConnectDatabase("your_postgres_dsn_here")

	// 2. Setup Fiber
	app := fiber.New()
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{AllowOrigins: "http://localhost:5173"}))

	// 3. Register ALL Routes perfectly
	api.SetupRoutes(app)

	// 4. Listen
	log.Fatal(app.Listen(":8080"))
}
