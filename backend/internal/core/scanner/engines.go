package scanner

import (
	"bufio"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// --- 1. SUBDOMAIN DISCOVERY (The "Subfinder" replacement) ---
type crtResponse struct {
	NameValue string `json:"name_value"`
}

// DiscoverSubdomains uses a Cascading Fallback Strategy for maximum stability and asset discovery.
func DiscoverSubdomains(rootDomain string) []string {
	uniqueDomains := make(map[string]bool)
	fmt.Printf("[*] DISCOVERY: Launching Cascading OSINT Engines for %s...\n", rootDomain)

	// ==========================================
	// ENGINE 1: crt.sh (Cascading: Wildcard -> Direct)
	// ==========================================
	client := &http.Client{Timeout: 15 * time.Second}
	crtSuccess := false

	// ATTEMPT A: The Heavy Wildcard Query
	fmt.Println("[*] crt.sh: Attempting massive wildcard query...")
	urlWildcard := fmt.Sprintf("https://crt.sh/?q=%%25.%s&output=json", rootDomain)
	reqW, _ := http.NewRequest("GET", urlWildcard, nil)
	reqW.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
	reqW.Header.Set("Accept", "application/json")

	respW, errW := client.Do(reqW)
	if errW == nil && respW.StatusCode == 200 {
		var entries []struct {
			NameValue string `json:"name_value"`
		}
		if err := json.NewDecoder(respW.Body).Decode(&entries); err == nil {
			for _, entry := range entries {
				for _, d := range strings.Split(entry.NameValue, "\n") {
					d = strings.ToLower(strings.TrimSpace(d))
					if d != "" && !strings.HasPrefix(d, "*.") && strings.HasSuffix(d, rootDomain) {
						uniqueDomains[d] = true
					}
				}
			}
			crtSuccess = true
			fmt.Println("[+] crt.sh wildcard discovery successful.")
		}
	}
	if respW != nil {
		respW.Body.Close()
	}

	// ATTEMPT B: The Optimized Direct Fallback
	if !crtSuccess {
		fmt.Println("[!] crt.sh wildcard failed (404/503). Downgrading to direct query...")
		urlDirect := fmt.Sprintf("https://crt.sh/?q=%s&output=json", rootDomain)
		reqD, _ := http.NewRequest("GET", urlDirect, nil)
		reqD.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
		reqD.Header.Set("Accept", "application/json")

		respD, errD := client.Do(reqD)
		if errD == nil && respD.StatusCode == 200 {
			var entries []struct {
				NameValue string `json:"name_value"`
			}
			if err := json.NewDecoder(respD.Body).Decode(&entries); err == nil {
				for _, entry := range entries {
					for _, d := range strings.Split(entry.NameValue, "\n") {
						d = strings.ToLower(strings.TrimSpace(d))
						if d != "" && !strings.HasPrefix(d, "*.") && strings.HasSuffix(d, rootDomain) {
							uniqueDomains[d] = true
						}
					}
				}
				fmt.Println("[+] crt.sh direct discovery successful.")
			}
		} else {
			fmt.Println("[!] crt.sh completely unavailable. Relying on backup engines.")
		}
		if respD != nil {
			respD.Body.Close()
		}
	}

	// ==========================================
	// ENGINE 2, 3 & 4: CertSpotter, HackerTarget & AlienVault
	// (These run concurrently to add any domains crt.sh missed)
	// ==========================================
	var wg sync.WaitGroup
	var mu sync.Mutex

	// CertSpotter
	wg.Add(1)
	go func() {
		defer wg.Done()
		certSpotterURL := fmt.Sprintf("https://api.certspotter.com/v1/issuances?domain=%s&include_subdomains=true&expand=dns_names", rootDomain)
		reqCS, _ := http.NewRequest("GET", certSpotterURL, nil)
		reqCS.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
		respCS, errCS := client.Do(reqCS)
		if errCS == nil && respCS.StatusCode == 200 {
			var issuances []struct {
				DNSNames []string `json:"dns_names"`
			}
			if err := json.NewDecoder(respCS.Body).Decode(&issuances); err == nil {
				mu.Lock()
				for _, issuance := range issuances {
					for _, d := range issuance.DNSNames {
						d = strings.ToLower(strings.TrimSpace(d))
						if d != "" && !strings.HasPrefix(d, "*.") && strings.HasSuffix(d, rootDomain) {
							uniqueDomains[d] = true
						}
					}
				}
				mu.Unlock()
			}
			fmt.Println("[+] CertSpotter discovery complete.")
		}
		if respCS != nil {
			respCS.Body.Close()
		}
	}()

	// HackerTarget
	wg.Add(1)
	go func() {
		defer wg.Done()
		resp, err := client.Get(fmt.Sprintf("https://api.hackertarget.com/hostsearch/?q=%s", rootDomain))
		if err == nil && resp.StatusCode == 200 {
			scanner := bufio.NewScanner(resp.Body)
			mu.Lock()
			for scanner.Scan() {
				parts := strings.Split(scanner.Text(), ",")
				if len(parts) > 0 {
					sub := strings.ToLower(strings.TrimSpace(parts[0]))
					if strings.HasSuffix(sub, rootDomain) {
						uniqueDomains[sub] = true
					}
				}
			}
			mu.Unlock()
			fmt.Println("[+] HackerTarget discovery complete.")
		}
		if resp != nil {
			resp.Body.Close()
		}
	}()

	// AlienVault OTX
	wg.Add(1)
	go func() {
		defer wg.Done()
		resp, err := client.Get(fmt.Sprintf("https://otx.alienvault.com/api/v1/indicators/domain/%s/passive_dns", rootDomain))
		if err == nil && resp.StatusCode == 200 {
			var otx struct {
				PassiveDNS []struct {
					Hostname string `json:"hostname"`
				} `json:"passive_dns"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&otx); err == nil {
				mu.Lock()
				for _, record := range otx.PassiveDNS {
					sub := strings.ToLower(strings.TrimSpace(record.Hostname))
					if sub != "" && !strings.HasPrefix(sub, "*.") && strings.HasSuffix(sub, rootDomain) {
						uniqueDomains[sub] = true
					}
				}
				mu.Unlock()
			}
			fmt.Println("[+] AlienVault OTX discovery complete.")
		}
		if resp != nil {
			resp.Body.Close()
		}
	}()

	wg.Wait()

	// ==========================================
	// Return Results
	// ==========================================
	var results []string
	for k := range uniqueDomains {
		results = append(results, k)
	}

	fmt.Printf("[✔] DISCOVERY SUCCESS: Found %d unique subdomains combined.\n", len(results))
	return results
}

// --- 2. DNS RESOLUTION (The "dnsx" replacement) ---
func ResolveIP(subdomain string) string {
	ips, err := net.LookupIP(subdomain)
	if err != nil {
		return ""
	}
	for _, ip := range ips {
		if ip.To4() != nil {
			return ip.String()
		}
	}
	return ""
}

// --- 3. PORT SCANNING (The "naabu" replacement) ---
func ScanPort(ip string, port int) bool {
	target := fmt.Sprintf("%s:%d", ip, port)
	conn, err := net.DialTimeout("tcp", target, 2*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// --- 4. HTTP PROBING (The "httpx" replacement) ---
type HTTPInfo struct {
	StatusCode int
	Title      string
	Server     string
}

func ProbeHTTP(domain string, port int) *HTTPInfo {
	protocol := "http"
	if port == 443 {
		protocol = "https"
	}

	client := http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	resp, err := client.Get(fmt.Sprintf("%s://%s", protocol, domain))
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	// Extract <title> for the dashboard
	title := "No Title"
	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096)) // Read first 4KB
	bodyStr := string(bodyBytes)

	start := strings.Index(strings.ToLower(bodyStr), "<title>")
	end := strings.Index(strings.ToLower(bodyStr), "</title>")
	if start != -1 && end != -1 {
		title = bodyStr[start+7 : end]
	}

	return &HTTPInfo{
		StatusCode: resp.StatusCode,
		Title:      strings.TrimSpace(title),
		Server:     resp.Header.Get("Server"),
	}
}

// --- 5. TLS PROBING (The PQC Engine) ---
// (We will use the ProbeTLS function we wrote previously for this)
// func ProbeTLS(domain string, ip string) *models.SSLCertificate { ... }
