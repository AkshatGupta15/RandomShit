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
