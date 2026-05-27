package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log"
)


func SeedCurrencies(ctx context.Context, db *sql.DB) error {
	currencies := []struct {
		id, name, planet, symbol string
		decimals                 int
	}{
		{"EARTH", "Earth Credits", "Earth", "EC", 8},
		{"MARS", "Mars Tokens", "Mars", "MT", 8},
		{"VENUS", "Venus Drachma", "Venus", "VD", 8},
		{"JUPITER", "Jupiter Juno", "Jupiter", "JJ", 8},
		{"SATURN", "Saturn Saturn", "Saturn", "SS", 8},
		{"MERCURY", "Mercury Mark", "Mercury", "MM", 8},
		{"MOON", "Lunar Lunes", "Moon", "LL", 8},
		{"ASTEROID", "Asteroid Credits", "Asteroid Belt", "AC", 8},
	}

	for _, c := range currencies {
		_, err := db.ExecContext(ctx, `
			INSERT INTO currencies (id, name, planet_name, symbol, decimals, is_active)
			VALUES ($1, $2, $3, $4, $5, TRUE)
			ON CONFLICT (id) DO NOTHING
		`, c.id, c.name, c.planet, c.symbol, c.decimals)
		if err != nil {
			return fmt.Errorf("failed to seed currency %s: %w", c.id, err)
		}
	}

	log.Println("✓ Currencies seeded")
	return nil
}
