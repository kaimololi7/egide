// Package main is the entry point for the Egide edge agent.
//
// Cross-platform single binary deployed on customer hosts. mTLS to the
// pipeline service. Posture collection: encryption, MFA, patch level,
// EDR presence. Optional Proxmox client and Ansible inventory reflection.
//
// Status: scaffold. Implementation lands at M7+ (cf. roadmap).
package main

import (
	"fmt"
	"os"
)

const version = "0.0.1"

func main() {
	fmt.Printf("egide-edge-agent %s — scaffold\n", version)
	fmt.Println("Implementation pending. M7+ refactor from aegis-platform.")
	os.Exit(0)
}
