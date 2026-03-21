# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary (adjust the path to your main package)
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/main ./cmd/api

# Runtime stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests (e.g., Groq API)
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/main .

# Expose the backend port
EXPOSE 8080

# Run the binary
CMD ["./main"]