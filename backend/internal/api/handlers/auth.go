package handlers

import (
	"os"
	"time"

	"github.com/AkshatGupta15/RandomShit/backend/internal/db"
	"github.com/AkshatGupta15/RandomShit/backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// In a real app, load this from .env. For the hackathon, this is fine.
var jwtSecret = []byte("pnb-hackathon-super-secret-key-2026")

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginUser - POST /api/v1/auth/login
func LoginUser(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	// 1. Find the user in the database
	var user models.User
	if err := db.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// 2. Check the password hash
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// 3. Create the JWT Token
	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"role":     user.Role,
		"exp":      time.Now().Add(time.Hour * 24).Unix(), // Expires in 24 hours
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, err := token.SignedString(jwtSecret)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	// 4. Set the Secure HttpOnly Cookie
	env := os.Getenv("ENV")

	secure := false
	sameSite := "Lax"

	if env == "production" {
		secure = true
		sameSite = "None"
	}

	c.Cookie(&fiber.Cookie{
		Name:     "jwt_auth",
		Value:    t,
		HTTPOnly: true,
		Secure:   secure,
		SameSite: sameSite,
	})
	return c.JSON(fiber.Map{
		"message": "Login successful",
		"user": fiber.Map{
			"id":       user.ID,
			"username": user.Username,
			"role":     user.Role,
		},
	})
}

// LogoutUser - POST /api/v1/auth/logout
func LogoutUser(c *fiber.Ctx) error {
	// Clear the cookie by setting it to a past expiration date
	c.Cookie(&fiber.Cookie{
		Name:     "jwt_auth",
		Value:    "",
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
	})

	return c.JSON(fiber.Map{"message": "Logged out successfully"})
}

// GetSessionUser - GET /api/v1/auth/me
// React calls this on page load to see if the user is still logged in
func GetSessionUser(c *fiber.Ctx) error {
	// 1. Get token from the cookie
	cookie := c.Cookies("jwt_auth")
	if cookie == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthenticated"})
	}

	// 2. Parse and validate the token
	token, err := jwt.Parse(cookie, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid or expired session"})
	}

	// 3. Extract claims and return to React
	claims := token.Claims.(jwt.MapClaims)

	return c.JSON(fiber.Map{
		"user": fiber.Map{
			"id":       claims["user_id"],
			"username": claims["username"],
			"role":     claims["role"],
		},
	})
}

type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// RegisterUser - POST /api/v1/auth/register
func RegisterUser(c *fiber.Ctx) error {
	var req RegisterRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Username == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Username and password required"})
	}

	// Check if user already exists
	var existing models.User
	if err := db.DB.Where("username = ?", req.Username).First(&existing).Error; err == nil {
		return c.Status(409).JSON(fiber.Map{"error": "User already exists"})
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 14)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	// Default role
	if req.Role == "" {
		req.Role = "user"
	}

	// Create user
	user := models.User{
		Username:     req.Username,
		PasswordHash: string(hashedPassword),
		Role:         req.Role,
	}

	if err := db.DB.Create(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user"})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "User registered successfully",
		"user": fiber.Map{
			"id":       user.ID,
			"username": user.Username,
			"role":     user.Role,
		},
	})
}
