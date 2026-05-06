// Package main is the entry point for the Egide pipeline service.
//
// Ingests events from edge agents and collectors, normalizes to a
// "control event" schema, publishes to NATS subjects.
//
// Status: scaffold. Implementation lands at M7+ (cf. roadmap).
package main

import (
	"fmt"
	"os"
)

const version = "0.0.1"

func main() {
	fmt.Printf("egide-pipeline %s — scaffold\n", version)
	fmt.Println("Implementation pending. M7+ when J2 starts.")
	os.Exit(0)
}
