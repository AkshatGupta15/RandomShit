#!/bin/bash

set -e
echo "🚀 Bootstrapping PNB Hackathon Monorepo..."

# 1. Scaffold Frontend using Vite (React + JavaScript)
echo "📦 Initializing Vite React Frontend..."
# npm create vite@latest frontend -- --template react
cd frontend

echo "📁 Structuring Frontend directories..."
mkdir -p src/assets src/components \
    src/features/dashboard src/features/inventory \
    src/features/discovery src/features/reporting \
    src/hooks src/services src/utils
rm -rf src/App.css
cd ..

# 2. Scaffold Backend (Golang)
echo "🐹 Initializing Go Backend..."
mkdir -p backend
cd backend
go mod init quantum-scanner

echo "📁 Structuring Backend directories..."
mkdir -p cmd/api \
    internal/api/handlers internal/api/middleware \
    internal/core/scanner internal/core/scoring internal/core/cbom \
    internal/models internal/db \
    pkg/cryptoutils config

touch cmd/api/main.go internal/api/routes.go internal/db/postgres.go \
      internal/core/scanner/tls_probe.go internal/core/scoring/scorer.go \
      config/config.go

cat <<EOF > cmd/api/main.go
package main

import "fmt"

func main() {
	fmt.Println("Quantum-Proof Scanner API is running...")
}
EOF
cd ..

# 3. Create Root Level Dev-Ops Files
echo "⚙️ Creating DevOps and Root files..."
mkdir -p .github/workflows deploy

cat <<EOF > Makefile
.PHONY: run-backend run-frontend run-all install-frontend

run-backend:
	@echo "Starting Go Backend..."
	cd backend && go run cmd/api/main.go

run-frontend:
	@echo "Starting React Frontend..."
	cd frontend && npm run dev

install-frontend:
	@echo "Installing Frontend Dependencies..."
	cd frontend && npm install

run-all:
	@make -j 2 run-backend run-frontend
EOF

cat <<EOF > docker-compose.yml
version: '3.8'
services:
  backend:
    build: 
      context: ./backend
      dockerfile: ../deploy/Dockerfile.backend
    ports:
      - "8080:8080"
  frontend:
    build:
      context: ./frontend
      dockerfile: ../deploy/Dockerfile.frontend
    ports:
      - "5173:5173"
EOF

touch README.md deploy/Dockerfile.backend deploy/Dockerfile.frontend

echo "✅ Setup Complete!"
