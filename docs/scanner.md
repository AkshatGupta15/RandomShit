# Asset Discovery & TLS Probing Engine

## Architectural Decision: Decoupled Engines
To align with enterprise UI/UX patterns, the scanning architecture is strictly decoupled into two distinct Go modules within `internal/core/scanner/`. This separation of concerns allows the frontend to independently populate the "Asset Discovery" dashboard and the "Asset Inventory / CBOM" dashboard.

## 1. The Discovery Engine (`discovery.go`)
**Purpose:** Rapid, wide-net reconnaissance to map the external attack surface of a target organization.

* **Data Source:** Queries the Certificate Transparency (CT) logs via `crt.sh`.
* **Concurrency:** Employs a Goroutine worker pool with a 50-worker Semaphore (`chan struct{}`). This ensures blazing-fast DNS resolution (IPv4 A-record lookups) across thousands of subdomains without triggering OS-level file descriptor limits or local network throttling.
* **Output:** Returns a slice of `DiscoveredAsset` structs containing verified live subdomains and their routing IPs.

## 2. The TLS Probing Engine (`tls_probe.go`)
**Purpose:** Surgical, deep-packet inspection of live endpoints to evaluate Post-Quantum Cryptography (PQC) readiness.

* **Execution:** Designed to accept the output of the Discovery Engine. For every live IP, it initiates a native Go `crypto/tls` handshake.
* **SNI Implementation:** Explicitly injects the `ServerName` into the TLS config to bypass strict enterprise firewalls, WAFs, and load balancers that reject direct IP-based handshakes.
* **Extraction:** Parses the X.509 certificate chain to determine the Certificate Authority, validity period (identifying expiring assets), Key Exchange Algorithms (identifying legacy RSA vs. ECC/Kyber), and TLS Protocol versions.
* **Output:** Returns a `ScannedCryptoAsset` struct, providing the raw data required by the CBOM generator and the Cyber Rating scoring algorithm.