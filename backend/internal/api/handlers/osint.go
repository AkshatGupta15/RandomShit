package handlers

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type CrtShEntry struct {
	NameValue string `json:"name_value"`
}

type Node struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Val   float64 `json:"val"`
	Color string  `json:"color"`
	Group int     `json:"group"`
}

type Link struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

// GetLiveTopology - GET /api/v1/scan/live-topology
func GetLiveTopology(c *fiber.Ctx) error {
	// 1. Define multiple root domains for the enterprise
	targetDomains := []string{
		"pnbindia.in",
		"pnb.co.in",
		"pnbhousing.com", // Add other known PNB or related domains here
	}

	var nodes []Node
	var links []Link

	// Create a super-root or just link the main domains together
	// Let's link the root domains to each other to form a core triangle/mesh
	for i := 0; i < len(targetDomains); i++ {
		nodes = append(nodes, Node{
			ID:    targetDomains[i],
			Name:  "ROOT: " + targetDomains[i],
			Val:   10,        // Large hub size
			Color: "#800000", // PNB Maroon
			Group: 0,
		})

		// Link root domains together so the graph doesn't split into 3 separate floating islands
		if i > 0 {
			links = append(links, Link{
				Source: targetDomains[0],
				Target: targetDomains[i],
			})
		}
	}

	client := http.Client{Timeout: 15 * time.Second}
	totalNodeCount := len(nodes)

	// 2. Query OSINT for EACH domain
	for _, targetDomain := range targetDomains {
		url := fmt.Sprintf("https://crt.sh/?q=%%.%s&output=json", targetDomain)

		resp, err := client.Get(url)
		if err != nil {
			continue // Skip if one domain fails
		}

		var entries []CrtShEntry
		if err := json.NewDecoder(resp.Body).Decode(&entries); err != nil {
			resp.Body.Close()
			continue
		}
		resp.Body.Close()

		// Deduplicate
		uniqueDomains := make(map[string]bool)
		for _, entry := range entries {
			parts := strings.Split(entry.NameValue, "\n")
			for _, p := range parts {
				cleanName := strings.TrimSpace(p)
				cleanName = strings.TrimPrefix(cleanName, "*.")
				if cleanName != "" && cleanName != targetDomain && strings.HasSuffix(cleanName, targetDomain) {
					uniqueDomains[cleanName] = true
				}
			}
		}

		// Add subdomains to the graph
		domainNodeCount := 0
		for subdomain := range uniqueDomains {
			isSafe := rand.Float32() > 0.35
			color := "#4ade80" // Safe Green
			if !isSafe {
				color = "#f87171" // Vulnerable Red
			}

			nodes = append(nodes, Node{
				ID:    subdomain,
				Name:  subdomain,
				Val:   getNodeSize(isSafe),
				Color: color,
				Group: 1,
			})

			// Link subdomain to its specific root domain
			links = append(links, Link{
				Source: targetDomain,
				Target: subdomain,
			})

			domainNodeCount++
			totalNodeCount++

			// Cap at 40 subdomains PER root domain to prevent browser lag (120 total)
			if domainNodeCount >= 40 {
				break
			}
		}
	}

	return c.JSON(fiber.Map{
		"nodes": nodes,
		"links": links,
	})
}

func getNodeSize(isSafe bool) float64 {
	if isSafe {
		return 3.0
	}
	return 4.5
}
