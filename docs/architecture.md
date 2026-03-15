# System Architecture

## Overview
The Quantum-Proof Enterprise Portal operates on a decoupled monorepo architecture, separating the high-performance data ingestion engine from the user visualization layer.

## Monorepo Layout
* **/backend**: A Golang (1.23+) REST API and concurrent scanning engine. Chosen for its native Goroutines enabling high-speed DNS resolution and TLS probing. Includes experimental support for `X25519Kyber768`.
* **/frontend**: A React (Vite) Single Page Application (SPA). Utilizes a feature-based directory structure (`/features/dashboard`, `/features/inventory`) to manage complex state and enterprise charting components.
* **/deploy**: Contains Dockerfiles for containerized deployment of both layers.
* **/docs**: Technical documentation and AI-assisted research guidelines.

## Data Flow
1. **Trigger:** The React client requests an asset scan via a REST API call.
2. **Discovery Phase:** The Go backend queries Certificate Transparency logs (`crt.sh`) to discover all registered subdomains for a target root domain.
3. **Resolution Phase:** Goroutines concurrently resolve IPv4 addresses for discovered subdomains.
4. **Probing Phase:** The backend executes TLS handshakes on port 443, extracting Cipher Suites, TLS Versions, and Key Lengths.
5. **Formatting:** Data is structured into standard JSON (and CycloneDX CBOM format) and returned to the React UI for rendering.