
# Quantum-Proof Enterprise Portal

[![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?logo=go)](https://golang.org/)
[![React Version](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

---

# 1. Executive Summary

The **Quantum-Proof Enterprise Portal** is a centralized **cryptographic auditing and posture-management platform** designed to help organizations prepare for the security challenges posed by quantum computing.

Future **cryptanalytically relevant quantum computers (CRQCs)** threaten current public-key cryptography systems such as RSA and ECC. Attackers may already be collecting encrypted traffic today to decrypt later once quantum capabilities mature — a strategy known as **Harvest Now, Decrypt Later (HNDL)**.

This platform provides **real-time visibility into the cryptographic posture of public-facing infrastructure**, including:

* Web servers
* APIs
* VPN gateways

The system analyzes TLS handshake data, converts it into a **Cryptographic Bill of Materials (CBOM)**, and calculates a **dynamic Cyber Rating** to help organizations migrate proactively toward **NIST-standardized Post-Quantum Cryptography (PQC)**.

---

# 2. System Architecture

The platform uses a **decoupled high-performance architecture** composed of a Go backend scanning engine and a React frontend analytics interface.

---

## 2.1 Backend Engine (Golang)

The backend is a **high-concurrency scanning and API engine** implemented in **Go (1.23+)**.

### Key Components

**TLS Probing Subsystem**

* Uses Go's `crypto/tls` package to perform TLS handshake analysis
* Supports hybrid post-quantum key exchange mechanisms such as `X25519Kyber768Draft00`
* Extracts cipher suites, certificate data, key exchange methods, and TLS versions

**Concurrency Model**

* Goroutine-based worker pools
* Efficient scanning of distributed IP ranges and domain assets
* Designed for minimal latency and high throughput

**REST API**

* Provides endpoints for the frontend client
* Handles:

  * CBOM generation
  * cryptographic scoring
  * scan orchestration
  * database operations

---

## 2.2 Frontend Client (React)

The frontend is a **React Single Page Application (SPA)** built with **Vite**.

### Key Features

**Modular Feature Architecture**

Each major feature is implemented as a separate module:

* Asset Discovery
* CBOM Visualization
* Security Posture Dashboard
* Reporting

**Data Visualization**

Enterprise-grade charts display:

* Risk distribution across assets
* TLS version adoption
* Certificate expiry timelines
* IPv4 vs IPv6 infrastructure distribution

---

# 3. Core Modules

## 1. Asset Discovery & Inventory

Discovers and tracks public-facing cryptographic assets across the enterprise network.

Monitored attributes include:

* TLS Version
* Cipher Suites
* Key Length
* Certificate details
* Public IP exposure

---

## 2. CBOM Generator

Automatically converts scan results into a **Cryptographic Bill of Materials (CBOM)**.

Features:

* Generates **CycloneDX v1.6 JSON**
* Standardized representation of cryptographic dependencies
* Enables security supply-chain transparency

---

## 3. PQC Posture Assessment

Evaluates discovered cipher suites and algorithms against modern cryptographic standards.

Assets are categorized into:

* **Elite — PQC Ready**
* **Standard**
* **Legacy**
* **Critical**

This helps organizations prioritize migration toward **post-quantum secure cryptography**.

---

## 4. Dynamic Cyber Rating

A scoring engine assigns each asset a **Cyber Rating (0–1000)** based on:

* TLS configuration
* cryptographic strength
* certificate security
* vulnerability exposure

This allows rapid identification of **high-risk infrastructure**.

---

## 5. Reporting Engine

Generates **executive-level security reports**, including:

* Security posture summaries
* vulnerability exposure
* migration readiness toward PQC

Reports can be:

* generated on demand
* scheduled for automated delivery
* exported as **PDF summaries**

---

## 6. Compliance Certification

Assets that meet modern cryptographic standards can automatically receive compliance labels such as:

* **Post-Quantum Cryptography Ready**
* **Fully Quantum Safe**

This enables organizations to demonstrate **future-ready security posture**.

---

# 4. Cryptographic Standards Compliance

The scanning engine aligns with modern cryptographic standards and frameworks.

### Supported Standards

**FIPS 203 — ML-KEM**

* Module-Lattice-Based Key Encapsulation Mechanism
* NIST standardized PQC key exchange

**FIPS 204 — ML-DSA**

* Module-Lattice-Based Digital Signature Algorithm
* Post-quantum secure signatures

**CycloneDX v1.6**

* Industry standard for **Cryptographic Bill of Materials (CBOM)** schemas
* Maintained by OWASP

---

# 5. Repository Structure

```
.
├── backend/                        # Golang API & TLS Scanner
│   ├── cmd/api/                    # Application entry point
│   ├── internal/api/               # HTTP routing and middleware
│   ├── internal/core/scanner/      # TLS probing logic
│   ├── internal/core/scoring/      # Cyber Rating algorithm
│   ├── internal/core/cbom/         # CycloneDX JSON generator
│   └── internal/db/                # PostgreSQL connection layer
│
├── frontend/                       # React SPA
│   ├── src/features/dashboard/     # Security posture analytics
│   ├── src/features/inventory/     # Asset tables & filtering
│   ├── src/features/cbom/          # CBOM visualization
│   └── src/features/reporting/     # PDF report generation
│
├── deploy/                         # Deployment configuration
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
│
└── Makefile                        # Build automation
```

---

# 6. Build & Deployment

## Prerequisites

Ensure the following tools are installed:

* Go **1.23+**
* Node.js **18+**
* npm
* GNU Make

---

# 7. Local Development Setup

## 1. Clone the Repository

```bash
git clone https://github.com/AkshatGupta15/PNB_Hackathon.git
cd PNB_Hackathon
```

---

## 2. Install Frontend Dependencies

```bash
make install-frontend
```

---

## 3. Run the Full Application

This command builds and runs both backend and frontend services.

```bash
make run-all
```

---

# 8. Network Configuration

| Service         | Default URL                                    |
| --------------- | ---------------------------------------------- |
| Backend API     | [http://localhost:8080](http://localhost:8080) |
| Frontend Client | [http://localhost:5173](http://localhost:5173) |
