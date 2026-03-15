func main() {
	// The ultimate list of root domains to scan
	targetDomains := []string{
		// --- PNB Core & International ---
		"pnbindia.in",
		"pnb.bank.in",
		"netpnb.com",
		"pnbint.com",
		"pnbdubai.com",
		"drukpnbbank.bt",
		"everestbankltd.com",
		
		// --- PNB Subsidiaries ---
		"pnbmetlife.com",
		"pnbhousing.com",
		"phfl.com",
		"pnbgilts.com",

		// --- Quantum-Safe Test Servers (To show "Elite-PQC" data) ---
		"test.openquantumsafe.org",
		"pq.cloudflarest.com",

		// --- Modern Tech / Control Group ---
		"google.com",
	}

	var allAssets []DetailedAsset

	fmt.Println("===================================================")
	fmt.Println(" INITIATING ENTERPRISE ASSET DISCOVERY & SCAN...")
	fmt.Println("===================================================")

	for _, domain := range targetDomains {
		// Discover and scan each root domain
		assets := DiscoverAndScan(domain)
		allAssets = append(allAssets, assets...)
	}

	fmt.Println("\n===================================================")
	fmt.Printf(" TOTAL ENTERPRISE ASSETS LOGGED: %d\n", len(allAssets))
	fmt.Println("===================================================")

	// Output the final combined JSON
	fmt.Println("\n--- FINAL JSON PAYLOAD FOR REACT FRONTEND ---")
	jsonOutput, _ := json.MarshalIndent(allAssets, "", "  ")
	fmt.Println(string(jsonOutput))
}