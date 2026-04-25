package models

import (
	"time"

	"github.com/google/uuid"
)


type Wallet struct {
	ID               uuid.UUID `db:"id" json:"id"`
	UserID           uuid.UUID `db:"user_id" json:"user_id"`
	CurrencyID       string    `db:"currency_id" json:"currency_id"`
	AvailableBalance float64   `db:"available_balance" json:"available_balance"`
	LockedBalance    float64   `db:"locked_balance" json:"locked_balance"`
	CreatedAt        time.Time `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time `db:"updated_at" json:"updated_at"`
}
