package main

// import (
// 	"bytes"
// 	"fmt"
// 	"os/exec"
// 	"strings"
// )

// func runCommand(name string, args ...string) ([]string, error) {
// 	cmd := exec.Command(name, args...)
// 	var out bytes.Buffer
// 	cmd.Stdout = &out

// 	err := cmd.Run()
// 	if err != nil {
// 		return nil, err
// 	}

// 	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
// 	return lines, nil
// }

// func main() {

// 	domain := "pnbindia.in"

// 	fmt.Println("Starting pipeline for:", domain)

// 	// Step 1 — Subdomain discovery
// 	fmt.Println("\n[1] Running subfinder...")
// 	subdomains, err := runCommand("subfinder", "-d", domain, "-silent")
// 	if err != nil {
// 		panic(err)
// 	}

// 	fmt.Println("Subdomains found:", len(subdomains))

// 	// Step 2 — DNS resolution
// 	fmt.Println("\n[2] Running dnsx...")
// 	dnsResolved, err := runCommand("dnsx", "-silent", "-l", "/dev/stdin")
// 	if err != nil {
// 		fmt.Println("dnsx error:", err)
// 	}

// 	// Instead we pipe manually
// 	cmd := exec.Command("dnsx", "-silent")
// 	cmd.Stdin = strings.NewReader(strings.Join(subdomains, "\n"))

// 	var dnsOut bytes.Buffer
// 	cmd.Stdout = &dnsOut
// 	cmd.Run()

// 	resolved := strings.Split(strings.TrimSpace(dnsOut.String()), "\n")
// 	fmt.Println("Resolved domains:", len(resolved))

// 	// Step 3 — Port scan
// 	fmt.Println("\n[3] Running naabu...")
// 	cmd = exec.Command("naabu", "-silent", "-top-ports", "100")
// 	cmd.Stdin = strings.NewReader(strings.Join(resolved, "\n"))

// 	var portOut bytes.Buffer
// 	cmd.Stdout = &portOut
// 	cmd.Run()

// 	ports := strings.Split(strings.TrimSpace(portOut.String()), "\n")
// 	fmt.Println("Open ports found:", len(ports))

// 	// Step 4 — HTTP detection
// 	fmt.Println("\n[4] Running httpx...")
// 	cmd = exec.Command("httpx", "-silent", "-title", "-status-code", "-tech-detect")
// 	cmd.Stdin = strings.NewReader(strings.Join(resolved, "\n"))

// 	var httpOut bytes.Buffer
// 	cmd.Stdout = &httpOut
// 	cmd.Run()

// 	httpResults := strings.Split(strings.TrimSpace(httpOut.String()), "\n")

// 	fmt.Println("\nAlive web services:")
// 	for _, r := range httpResults {
// 		fmt.Println(r)
// 	}

// 	fmt.Println("\nPipeline completed")
// }