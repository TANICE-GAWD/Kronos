package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"backend/internal/models"
	"github.com/google/uuid"
)


type TransactionRepository interface {
	CreateTransaction(ctx context.Context, tx *models.Transaction) error
	SettleTransaction(ctx context.Context, transactionID, senderWalletID, receiverWalletID uuid.UUID, amount float64, currencyID string) error
	VoidTransaction(ctx context.Context, transactionID, senderWalletID uuid.UUID, amount float64, currencyID string) error
	GetTransaction(ctx context.Context, transactionID uuid.UUID) (*models.Transaction, error)
	GetAllTransactions(ctx context.Context) ([]*models.Transaction, error)
}


type TransactionRepositoryImpl struct {
	db *sql.DB
}


func NewTransactionRepository(db *sql.DB) TransactionRepository {
	return &TransactionRepositoryImpl{db: db}
}


func (r *TransactionRepositoryImpl) CreateTransaction(ctx context.Context, tx *models.Transaction) error {
	if tx.ID == uuid.Nil {
		tx.ID = uuid.New()
	}

	query := `
		INSERT INTO transactions (id, sender_id, receiver_id, amount, status, origin_planet, destination_planet, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		tx.ID,
		tx.SenderID,
		tx.ReceiverID,
		tx.Amount,
		tx.Status,
		tx.OriginPlanet,
		tx.DestinationPlanet,
		tx.CreatedAt,
		tx.UpdatedAt,
	).Scan(&tx.ID, &tx.CreatedAt, &tx.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create transaction: %w", err)
	}

	return nil
}



func (r *TransactionRepositoryImpl) SettleTransaction(ctx context.Context, transactionID, senderWalletID, receiverWalletID uuid.UUID, amount float64, currencyID string) error {
	
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		log.Printf("[Settlement] Failed to begin transaction for %s: %v", transactionID, err)
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() 

	
	deductQuery := `
		UPDATE wallets
		SET locked_balance = locked_balance - $2
		WHERE id = $1 AND locked_balance >= $2
	`
	result, err := tx.ExecContext(ctx, deductQuery, senderWalletID, amount)
	if err != nil {
		log.Printf("[Settlement] Failed to deduct from sender wallet %s locked balance: %v", senderWalletID, err)
		return fmt.Errorf("failed to deduct from sender: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		log.Printf("[Settlement] Insufficient locked balance for sender wallet %s or wallet not found", senderWalletID)
		return fmt.Errorf("insufficient locked balance or wallet not found for sender")
	}

	
	creditQuery := `
		UPDATE wallets
		SET available_balance = available_balance + $2
		WHERE id = $1
	`
	result, err = tx.ExecContext(ctx, creditQuery, receiverWalletID, amount)
	if err != nil {
		log.Printf("[Settlement] Failed to credit receiver wallet %s available balance: %v", receiverWalletID, err)
		return fmt.Errorf("failed to credit receiver: %w", err)
	}

	rowsAffected, err = result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		log.Printf("[Settlement] Receiver wallet not found for wallet_id %s", receiverWalletID)
		return fmt.Errorf("receiver wallet not found")
	}

	
	statusQuery := `
		UPDATE transactions
		SET status = 'settled'
		WHERE id = $1
	`
	_, err = tx.ExecContext(ctx, statusQuery, transactionID)
	if err != nil {
		log.Printf("[Settlement] Failed to update transaction %s status: %v", transactionID, err)
		return fmt.Errorf("failed to update transaction status: %w", err)
	}

	
	if err := tx.Commit(); err != nil {
		log.Printf("[Settlement] Failed to commit settlement for %s: %v", transactionID, err)
		return fmt.Errorf("failed to commit settlement: %w", err)
	}

	log.Printf("[Settlement] ✓ Transaction %s settled: %f %s from sender_wallet=%s to receiver_wallet=%s", transactionID, amount, currencyID, senderWalletID, receiverWalletID)
	return nil
}



func (r *TransactionRepositoryImpl) VoidTransaction(ctx context.Context, transactionID, senderWalletID uuid.UUID, amount float64, currencyID string) error {
	
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		log.Printf("[Void] Failed to begin transaction for %s: %v", transactionID, err)
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() 

	
	deductQuery := `
		UPDATE wallets
		SET locked_balance = locked_balance - $2
		WHERE id = $1 AND locked_balance >= $2
	`
	result, err := tx.ExecContext(ctx, deductQuery, senderWalletID, amount)
	if err != nil {
		log.Printf("[Void] Failed to deduct from sender wallet %s locked balance: %v", senderWalletID, err)
		return fmt.Errorf("failed to deduct from locked balance: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		log.Printf("[Void] Insufficient locked balance for sender wallet %s", senderWalletID)
		return fmt.Errorf("insufficient locked balance or wallet not found")
	}

	
	creditQuery := `
		UPDATE wallets
		SET available_balance = available_balance + $2
		WHERE id = $1
	`
	result, err = tx.ExecContext(ctx, creditQuery, senderWalletID, amount)
	if err != nil {
		log.Printf("[Void] Failed to credit sender wallet %s available balance: %v", senderWalletID, err)
		return fmt.Errorf("failed to credit sender: %w", err)
	}

	rowsAffected, err = result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		log.Printf("[Void] Sender wallet not found for wallet_id %s", senderWalletID)
		return fmt.Errorf("sender wallet not found")
	}

	
	statusQuery := `
		UPDATE transactions
		SET status = 'failed'
		WHERE id = $1
	`
	_, err = tx.ExecContext(ctx, statusQuery, transactionID)
	if err != nil {
		log.Printf("[Void] Failed to update transaction %s status: %v", transactionID, err)
		return fmt.Errorf("failed to update transaction status: %w", err)
	}

	
	if err := tx.Commit(); err != nil {
		log.Printf("[Void] Failed to commit void for %s: %v", transactionID, err)
		return fmt.Errorf("failed to commit void: %w", err)
	}

	log.Printf("[Void] ✓ Transaction %s voided: %f %s refunded to sender_wallet=%s", transactionID, amount, currencyID, senderWalletID)
	return nil
}


func (r *TransactionRepositoryImpl) GetTransaction(ctx context.Context, transactionID uuid.UUID) (*models.Transaction, error) {
	query := `
		SELECT id, sender_id, receiver_id, amount, status, origin_planet, destination_planet, created_at, updated_at
		FROM transactions
		WHERE id = $1
	`

	transaction := &models.Transaction{}
	err := r.db.QueryRowContext(ctx, query, transactionID).Scan(
		&transaction.ID,
		&transaction.SenderID,
		&transaction.ReceiverID,
		&transaction.Amount,
		&transaction.Status,
		&transaction.OriginPlanet,
		&transaction.DestinationPlanet,
		&transaction.CreatedAt,
		&transaction.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("transaction not found: %w", err)
		}
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}

	return transaction, nil
}

// GetAllTransactions retrieves all transactions from the database
func (r *TransactionRepositoryImpl) GetAllTransactions(ctx context.Context) ([]*models.Transaction, error) {
	query := `
		SELECT id, sender_id, receiver_id, amount, status, origin_planet, destination_planet, created_at, updated_at
		FROM transactions
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query transactions: %w", err)
	}
	defer rows.Close()

	transactions := []*models.Transaction{}
	for rows.Next() {
		transaction := &models.Transaction{}
		err := rows.Scan(
			&transaction.ID,
			&transaction.SenderID,
			&transaction.ReceiverID,
			&transaction.Amount,
			&transaction.Status,
			&transaction.OriginPlanet,
			&transaction.DestinationPlanet,
			&transaction.CreatedAt,
			&transaction.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan transaction: %w", err)
		}
		transactions = append(transactions, transaction)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating transactions: %w", err)
	}

	return transactions, nil
}
