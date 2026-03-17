package api

import (
	"github.com/gofiber/fiber/v2"
)

// SetupRoutes registers all the API endpoints for the PNB Enterprise Portal
func SetupRoutes(app *fiber.App) {
	
	// Create the base API v1 group
	v1 := app.Group("/api/v1")

	// ==========================================
	// 1. SYSTEM & HEALTH (For load balancers & UI checks)
	// ==========================================
	sys := v1.Group("/system")
	sys.Get("/health", /* handlers.HealthCheck */) 
	sys.Get("/engine-status", /* handlers.ScannerEngineStatus */) 

	// ==========================================
	// 2. AUTHENTICATION & USERS (Role-based access)
	// ==========================================
	auth := v1.Group("/auth")
	auth.Post("/login", /* handlers.LoginUser */)
	auth.Post("/logout", /* handlers.LogoutUser */)
	auth.Get("/me", /* handlers.GetSessionUser */) // Fetches "hackathon_user" profile

	// ==========================================
	// 3. DASHBOARD ANALYTICS (Powers the React Tremor Charts)
	// ==========================================
	dash := v1.Group("/dashboard")
	dash.Get("/kpis", /* handlers.GetTopKPIs */)                   // Expiring certs, risk totals
	dash.Get("/charts/risk", /* handlers.GetRiskDistribution */)   // Web apps vs APIs vs Servers
	dash.Get("/charts/expiry", /* handlers.GetExpiryTimeline */)   // 30-60-90 day certificate data

	// ==========================================
	// 4. SCANNER ORCHESTRATION (The Background Engine)
	// ==========================================
	scan := v1.Group("/scan")
	scan.Post("/start", /* handlers.StartPipeline */)            // Triggers the heavy background worker
	scan.Post("/stop/:domainId", /* handlers.StopPipeline */)    // Emergency halt
	scan.Get("/status/:domainId", /* handlers.GetScanProgress */) // Real-time % complete for the UI loader

	// ==========================================
	// 5. ROOT DOMAIN MANAGEMENT (The targets)
	// ==========================================
	domains := v1.Group("/domains")
	domains.Get("/", /* handlers.ListRootDomains */)          // Lists pnbindia.in, netpnb.com
	domains.Post("/", /* handlers.AddRootDomain */)           // Admin adds a new target
	domains.Delete("/:id", /* handlers.RemoveRootDomain */)   // Cascading delete of all discovered data

	// ==========================================
	// 6. ASSET INVENTORY (The Discovered Hub)
	// ==========================================
	assets := v1.Group("/inventory")
	assets.Get("/", /* handlers.ListAllAssets */)             // Master table view
	assets.Get("/:subdomainId", /* handlers.GetAssetDetail */) // Deep dive into one specific IP/Server
	assets.Get("/filter/ports", /* handlers.FilterByPort */)   // Find all assets with port 8443 open
	assets.Get("/filter/tech", /* handlers.FilterByTech */)    // Find all IIS or Nginx servers

	// ==========================================
	// 7. CRYPTOGRAPHIC POSTURE (The PQC/TLS Data)
	// ==========================================
	crypto := v1.Group("/crypto")
	crypto.Get("/certificates", /* handlers.ListAllCerts */)
	crypto.Get("/vulnerabilities", /* handlers.ListLegacyCrypto */) // Pulls all TLS 1.0/1.1 or RSA-1024
	crypto.Get("/quantum-ready", /* handlers.ListEliteCrypto */)    // Pulls all Kyber-negotiated assets

	// ==========================================
	// 8. COMPLIANCE & EXPORTING (Hackathon Winning Feature)
	// ==========================================
	export := v1.Group("/export")
	export.Get("/cbom", /* handlers.DownloadCBOMJson */)      // Exports Cryptographic Bill of Materials (CycloneDX format)
	export.Get("/pdf-report", /* handlers.DownloadPDFReport */) // Executive summary for PNB management

	// ==========================================
	// 9. CONFIGURATION & SETTINGS
	// ==========================================
	settings := v1.Group("/settings")
	settings.Get("/scanner-rules", /* handlers.GetScannerConfig */) // e.g., timeout limits, concurrent workers
	settings.Put("/scanner-rules", /* handlers.UpdateScannerConfig */)
}