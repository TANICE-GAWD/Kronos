// to define the model of star credit(money)

// needs : >> identity, payload, time, status, co-ordinaates

package packet

import (
	 "time"
	 "github.com/google/uuid"
	 "math"
	 
	 

)

type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type EnumStatus string

const (
	Active EnumStatus = "active" // in transfer
	Stalled EnumStatus = "stalled"  // near a blackhole i.e the gravity is like slowing time down...so it is taking longer
	Destroyed EnumStatus = "destroyed" // crossed event horizon
	Settled EnumStatus = "settled"
)

type Payload struct {
	Amount     float64 `json:"amount"`
	CurrencyID string  `json:"currency_id"`
}

type Packet struct {
	ID         uuid.UUID `json:"id"`
	Start      Point     `json:"start"`
	End        Point     `json:"end"`
	CurrentPos Point     `json:"current_pos"`
	Payload    Payload   `json:"payload"`
	LaunchTime time.Time `json:"launch_time"`
	ETA        time.Time `json:"eta"`
	Status     EnumStatus `json:"status"`
	DilationFactor float64 `json:"dilationfactor"`
	Velocity       float64   `json:"velocity"`
}


func (p Packet) Distance(a Point, b Point) float64 {


	return math.Sqrt(
			math.Pow(b.X-a.X, 2) +
			math.Pow(b.Y-a.Y, 2) +
			math.Pow(b.Z-a.Z, 2),
	)
}