package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)


type PostgresRepository struct {
	db *sql.DB
}


func NewPostgresRepository(databaseURL string) (*PostgresRepository, error) {
	
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	
	db.SetMaxOpenConns(25)   
	db.SetMaxIdleConns(5)    
	db.SetConnMaxLifetime(5 * time.Minute) 

	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &PostgresRepository{db: db}, nil
}


func (pr *PostgresRepository) Close() error {
	if pr.db != nil {
		return pr.db.Close()
	}
	return nil
}



func (pr *PostgresRepository) GetDB() *sql.DB {
	return pr.db
}
