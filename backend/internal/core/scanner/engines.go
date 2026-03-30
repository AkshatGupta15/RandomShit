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

func DiscoverSubdomains(rootDomain string) []string {
	uniqueDomains := make(map[string]bool)
	client := &http.Client{Timeout: 15 * time.Second}

	// 1. crt.sh Direct Query
	urlDirect := fmt.Sprintf("https://crt.sh/?q=%s&output=json", rootDomain)
	reqD, _ := http.NewRequest("GET", urlDirect, nil)
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
		}
	}
	if respD != nil {
		respD.Body.Close()
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	// 2. CertSpotter
	wg.Add(1)
	go func() {
		defer wg.Done()
		certSpotterURL := fmt.Sprintf("https://api.certspotter.com/v1/issuances?domain=%s&include_subdomains=true&expand=dns_names", rootDomain)
		respCS, errCS := client.Get(certSpotterURL)
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
		}
		if respCS != nil {
			respCS.Body.Close()
		}
	}()

	// 3. HackerTarget
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
		}
		if resp != nil {
			resp.Body.Close()
		}
	}()

	wg.Wait()

	var results []string
	for k := range uniqueDomains {
		results = append(results, k)
	}
	return results
}

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

func ScanPort(ip string, port int) bool {
	target := fmt.Sprintf("%s:%d", ip, port)
	conn, err := net.DialTimeout("tcp", target, 2*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

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
		Timeout:   5 * time.Second,
		Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
	}

	resp, err := client.Get(fmt.Sprintf("%s://%s", protocol, domain))
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	title := "No Title"
	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
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
