package models

import (
	"time"

	"github.com/google/uuid"
)


type Transaction struct {
	ID                 uuid.UUID `db:"id" json:"id"`
	SenderID           uuid.UUID `db:"sender_id" json:"sender_id"`
	ReceiverID         uuid.UUID `db:"receiver_id" json:"receiver_id"`
	Amount             float64   `db:"amount" json:"amount"`
	Status             string    `db:"status" json:"status"` 
	OriginPlanet       string    `db:"origin_planet" json:"origin_planet"`
	DestinationPlanet  string    `db:"destination_planet" json:"destination_planet"`
	CreatedAt          time.Time `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time `db:"updated_at" json:"updated_at"`
}


const (
	TransactionPending = "pending"
	TransactionSettled = "settled"
	TransactionFailed  = "failed"
)
