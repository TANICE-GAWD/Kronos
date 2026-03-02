// to define the model of star credit(money)

// needs : >> identity, payload, time, status, co-ordinaates

package packet

import (
	 "time"
	 "github.com/google/uuid"

)

type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type EnumStatus string

const (
	InFlight EnumStatus = "in-flight"
	GravityCaught EnumStatus = "caught-in-gravity"
	Blocked EnumStatus = "blocked"
	Arrived EnumStatus = "arrived"
)

type Payload struct {
	Amount     float64 `json:"amount"`
	CurrencyID string  `json:"currency_id"`
}

type Packet struct {
	ID         uuid.UUID `json:"id"`
	Start      Point     `json:"start"`
	End        Point     `json:"end"`
	Payload    Payload   `json:"payload"`
	LaunchTime time.Time `json:"launch_time"`
	ETA        time.Time `json:"eta"`
	Status     Status    `json:"status"`
}