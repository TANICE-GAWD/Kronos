package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"backend/internal/models"
	"github.com/google/uuid"
)


type WalletRepository interface {
	CreateWallet(ctx context.Context, wallet *models.Wallet) error
	GetWalletByUserIDAndCurrency(ctx context.Context, userID uuid.UUID, currencyID string) (*models.Wallet, error)
	UpdateWalletBalance(ctx context.Context, walletID uuid.UUID, availableBalance, lockedBalance float64) error
	LockFundsInWallet(ctx context.Context, walletID uuid.UUID, amount float64) error
}


type WalletRepositoryImpl struct {
	db *sql.DB
}


func NewWalletRepository(db *sql.DB) WalletRepository {
	return &WalletRepositoryImpl{db: db}
}


func (r *WalletRepositoryImpl) CreateWallet(ctx context.Context, wallet *models.Wallet) error {
	
	if wallet.ID == uuid.Nil {
		wallet.ID = uuid.New()
	}

	query := `
		INSERT INTO wallets (id, user_id, currency_id, available_balance, locked_balance, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		wallet.ID,
		wallet.UserID,
		wallet.CurrencyID,
		wallet.AvailableBalance,
		wallet.LockedBalance,
		wallet.CreatedAt,
		wallet.UpdatedAt,
	).Scan(&wallet.ID, &wallet.CreatedAt, &wallet.UpdatedAt)

	if err != nil {
		
		if err.Error() == "pq: duplicate key value violates unique constraint \"wallets_user_id_currency_id_key\"" {
			return fmt.Errorf("wallet already exists for this user and currency: %w", err)
		}
		return fmt.Errorf("failed to create wallet: %w", err)
	}

	return nil
}


func (r *WalletRepositoryImpl) GetWalletByUserIDAndCurrency(ctx context.Context, userID uuid.UUID, currencyID string) (*models.Wallet, error) {
	query := `
		SELECT id, user_id, currency_id, available_balance, locked_balance, created_at, updated_at
		FROM wallets
		WHERE user_id = $1 AND currency_id = $2
	`

	wallet := &models.Wallet{}
	err := r.db.QueryRowContext(ctx, query, userID, currencyID).Scan(
		&wallet.ID,
		&wallet.UserID,
		&wallet.CurrencyID,
		&wallet.AvailableBalance,
		&wallet.LockedBalance,
		&wallet.CreatedAt,
		&wallet.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("wallet not found: %w", err)
		}
		return nil, fmt.Errorf("failed to get wallet: %w", err)
	}

	return wallet, nil
}


func (r *WalletRepositoryImpl) UpdateWalletBalance(ctx context.Context, walletID uuid.UUID, availableBalance, lockedBalance float64) error {
	query := `
		UPDATE wallets
		SET available_balance = $2, locked_balance = $3
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query, walletID, availableBalance, lockedBalance)
	if err != nil {
		return fmt.Errorf("failed to update wallet balance: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("wallet not found")
	}

	return nil
}

// LockFundsInWallet atomically locks funds by moving from available to locked balance
func (r *WalletRepositoryImpl) LockFundsInWallet(ctx context.Context, walletID uuid.UUID, amount float64) error {
	query := `
		UPDATE wallets
		SET available_balance = available_balance - $2,
		    locked_balance = locked_balance + $2
		WHERE id = $1 AND available_balance >= $2
		RETURNING available_balance, locked_balance
	`

	var newAvailable, newLocked float64
	err := r.db.QueryRowContext(ctx, query, walletID, amount).Scan(&newAvailable, &newLocked)
	
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("insufficient balance or wallet not found")
		}
		return fmt.Errorf("failed to lock funds: %w", err)
	}

	return nil
}
