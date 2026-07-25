package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

type PairingState struct {
	Status    string    `json:"status"`
	QRCode    string    `json:"qr_code,omitempty"`
	UpdatedAt time.Time `json:"updated_at"`
}

// writePairingState gives the native companion a structured QR payload without
// exposing an unauthenticated network endpoint before the bridge API is ready.
// The file lives beside the private session databases in the bridge store.
func writePairingState(status, qrCode string) {
	state := PairingState{Status: status, QRCode: qrCode, UpdatedAt: time.Now().UTC()}
	payload, err := json.Marshal(state)
	if err != nil {
		return
	}
	path := filepath.Join("store", "pairing.json")
	tempPath := path + ".tmp"
	if err := os.WriteFile(tempPath, payload, 0600); err != nil {
		return
	}
	_ = os.Rename(tempPath, path)
}
