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
	// 1. Connect DB
	// db.ConnectDatabase("postgres://postgres:password@localhost:5432/postgres?sslmode=disable")

	err := godotenv.Load("../.env")
	if err != nil {
		log.Println("No .env file found")
	}
	log.Println("DATABASE_URL:npg_B8hprRnI9FjX@ep-sparkling-waterfall-ak92cp6y-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require", os.Getenv("npg_B8hprRnI9FjX@ep-sparkling-waterfall-ak92cp6y-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require")) // debug
	// Connect DB
	db.ConnectDatabase(os.Getenv("npg_B8hprRnI9FjX@ep-sparkling-waterfall-ak92cp6y-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"))
	// 2. Setup Fiber
	app := fiber.New()
	app.Use(logger.New())
	// app.Use(cors.New(cors.Config{AllowOrigins: "http://localhost:3000"}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
	}))

	// 3. Register ALL Routes perfectly
	api.SetupRoutes(app)

	// 4. Listen
	log.Fatal(app.Listen(":8080"))
}
