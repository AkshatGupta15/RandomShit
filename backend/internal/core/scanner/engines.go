package scanner

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// --- 1. SUBDOMAIN DISCOVERY (The "Subfinder" replacement) ---
type crtResponse struct {
	NameValue string `json:"name_value"`
}

func DiscoverSubdomains(rootDomain string) []string {
	client := http.Client{Timeout: 45 * time.Second}
	url := fmt.Sprintf("https://crt.sh/?q=%%25.%s&output=json", rootDomain)
	
	resp, err := client.Get(url)
	if err != nil || resp.StatusCode != http.StatusOK {
		return nil
	}
	defer resp.Body.Close()

	var entries []crtResponse
	json.NewDecoder(resp.Body).Decode(&entries)

	unique := make(map[string]bool)
	for _, entry := range entries {
		for _, d := range strings.Split(entry.NameValue, "\n") {
			d = strings.ToLower(strings.TrimSpace(d))
			if d != "" && !strings.HasPrefix(d, "*.") && strings.HasSuffix(d, rootDomain) {
				unique[d] = true
			}
		}
	}

	var results []string
	for k := range unique {
		results = append(results, k)
	}
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