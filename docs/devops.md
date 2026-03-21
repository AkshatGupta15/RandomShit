# Development & Deployment Operations

## Overview
Local development and deployment are automated via a root-level `Makefile`. This ensures consistent startup sequences across different developer machines.

## Available Commands

| Command | Action |
| :--- | :--- |
| `make install-frontend` | Navigates to `/frontend` and installs Node modules via `npm install`. |
| `make run-backend` | Executes the Golang API server (`go run cmd/api/main.go`). |
| `make run-frontend` | Starts the Vite React development server (`npm run dev`). |
| `make run-all` | Concurrently spins up both the backend and frontend in the same terminal instance. |
