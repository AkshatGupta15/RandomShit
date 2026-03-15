// backend/internal/core/scanner/discovery.go
package scanner

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// DiscoveredAsset represents a found subdomain and its active IPs
type DiscoveredAsset struct {
	Subdomain string   `json:"subdomain"`
	IPs       []string `json:"ips"`
}

type crtShResponse struct {
	NameValue string `json:"name_value"`
}

// DiscoverAssets finds all live subdomains for a root domain
func DiscoverAssets(rootDomain string) []DiscoveredAsset {
	fmt.Printf("[*] DISCOVERY: Querying logs for %s...\n", rootDomain)

	client := http.Client{Timeout: 90 * time.Second}
	url := fmt.Sprintf("https://crt.sh/?q=%%25.%s&output=json", rootDomain)
	
	resp, err := client.Get(url)
	if err != nil || resp.StatusCode != http.StatusOK {
		fmt.Println("[!] DISCOVERY: API unavailable or timed out.")
		return nil
	}
	defer resp.Body.Close()

	var entries []crtShResponse
	json.NewDecoder(resp.Body).Decode(&entries)

	uniqueDomains := make(map[string]bool)
	for _, entry := range entries {
		for _, d := range strings.Split(entry.NameValue, "\n") {
			d = strings.ToLower(strings.TrimSpace(d))
			if d != "" && !strings.HasPrefix(d, "*.") && strings.HasSuffix(d, rootDomain) {
				uniqueDomains[d] = true
			}
		}
	}

	var results []DiscoveredAsset
	var mu sync.Mutex
	var wg sync.WaitGroup

	semaphore := make(chan struct{}, 50) // Max 50 concurrent DNS lookups

	for domain := range uniqueDomains {
		wg.Add(1)
		semaphore <- struct{}{}

		go func(sub string) {
			defer wg.Done()
			defer func() { <-semaphore }()

			ips, err := net.LookupIP(sub)
			if err != nil {
				return
			}

			var activeIPs []string
			for _, ip := range ips {
				if ip.To4() != nil {
					activeIPs = append(activeIPs, ip.String())
				}
			}

			if len(activeIPs) > 0 {
				mu.Lock()
				results = append(results, DiscoveredAsset{
					Subdomain: sub,
					IPs:       activeIPs,
				})
				mu.Unlock()
			}
		}(domain)
	}

	wg.Wait()
	fmt.Printf("[✔] DISCOVERY: Found %d active endpoints.\n", len(results))
	return results
}