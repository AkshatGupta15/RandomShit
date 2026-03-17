package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/AkshatGupta15/RandomShit/backend/internal/api"
	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	// ---------- Database ----------
	if err := db.Connect(); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	log.Println("Database connected")

	// ---------- Fiber App ----------
	app := fiber.New(fiber.Config{
		AppName: "Quantum-Proof Enterprise Portal",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(recover.New())
	app.Use(cors.New())

	// ---------- Routes ----------
	api.SetupRoutes(app)

	// ---------- Graceful Shutdown ----------
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-c
		log.Println("Shutting down...")
		db.Close()
		app.Shutdown()
	}()

	// ---------- Start Server ----------
	log.Fatal(app.Listen(":8080"))
}
