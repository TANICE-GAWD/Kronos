package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"backend/internal/models"
	"github.com/google/uuid"
)

// WealthSummary represents aggregated wealth across currencies
type WealthSummary struct {
	CurrencyID       string
	CurrencyName     string
	AvailableBalance float64
	LockedBalance    float64
	TotalBalance     float64
}

// WalletWithCurrencyInfo represents a wallet with detailed currency information
type WalletWithCurrencyInfo struct {
	WalletID         uuid.UUID
	CurrencyID       string
	CurrencyName     string
	AvailableBalance float64
	LockedBalance    float64
	TotalBalance     float64
	CreatedAt        string
}


type WalletRepository interface {
	CreateWallet(ctx context.Context, wallet *models.Wallet) error
	GetWalletByUserIDAndCurrency(ctx context.Context, userID uuid.UUID, currencyID string) (*models.Wallet, error)
	UpdateWalletBalance(ctx context.Context, walletID uuid.UUID, availableBalance, lockedBalance float64) error
	LockFundsInWallet(ctx context.Context, walletID uuid.UUID, amount float64) error
	GetAllWallets(ctx context.Context) ([]*models.Wallet, error)
	// NEW: Wealth summary and detailed wallet queries
	GetUserWealthSummary(ctx context.Context, userID uuid.UUID) ([]WealthSummary, error)
	GetUserWalletsWithCurrencyInfo(ctx context.Context, userID uuid.UUID) ([]WalletWithCurrencyInfo, error)
}


type WalletRepositoryImpl struct {
	db *sql.DB
}


func NewWalletRepository(db *sql.DB) WalletRepository {
	return &WalletRepositoryImpl{db: db}
}

func normalizeCurrencyID(currencyID string) string {
	return strings.ToUpper(strings.TrimSpace(currencyID))
}


func (r *WalletRepositoryImpl) CreateWallet(ctx context.Context, wallet *models.Wallet) error {
	wallet.CurrencyID = normalizeCurrencyID(wallet.CurrencyID)

	existingWallet, existingErr := r.GetWalletByUserIDAndCurrency(ctx, wallet.UserID, wallet.CurrencyID)
	if existingErr == nil && existingWallet != nil {
		wallet.ID = existingWallet.ID
		wallet.CreatedAt = existingWallet.CreatedAt
		wallet.UpdatedAt = existingWallet.UpdatedAt
		return nil
	}

	
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
	currencyID = normalizeCurrencyID(currencyID)

	query := `
		SELECT id, user_id, currency_id, available_balance, locked_balance, created_at, updated_at
		FROM wallets
		WHERE user_id = $1 AND UPPER(TRIM(currency_id)) = $2
		ORDER BY created_at ASC
		LIMIT 1
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

// GetAllWallets retrieves all wallets from the database
func (r *WalletRepositoryImpl) GetAllWallets(ctx context.Context) ([]*models.Wallet, error) {
	query := `
		SELECT id, user_id, currency_id, available_balance, locked_balance, created_at, updated_at
		FROM wallets
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query wallets: %w", err)
	}
	defer rows.Close()

	wallets := []*models.Wallet{}
	for rows.Next() {
		wallet := &models.Wallet{}
		err := rows.Scan(
			&wallet.ID,
			&wallet.UserID,
			&wallet.CurrencyID,
			&wallet.AvailableBalance,
			&wallet.LockedBalance,
			&wallet.CreatedAt,
			&wallet.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan wallet: %w", err)
		}
		wallets = append(wallets, wallet)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating wallets: %w", err)
	}

	return wallets, nil
}

// GetUserWealthSummary retrieves user's total wealth breakdown by currency using stored procedure
func (r *WalletRepositoryImpl) GetUserWealthSummary(ctx context.Context, userID uuid.UUID) ([]WealthSummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT currency_id, currency_name, available_balance, locked_balance, total_balance
		FROM sp_get_user_wealth_summary($1)
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("failed to query wealth summary: %w", err)
	}
	defer rows.Close()

	var summaries []WealthSummary
	for rows.Next() {
		var summary WealthSummary
		err := rows.Scan(
			&summary.CurrencyID,
			&summary.CurrencyName,
			&summary.AvailableBalance,
			&summary.LockedBalance,
			&summary.TotalBalance,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan wealth summary: %w", err)
		}
		summaries = append(summaries, summary)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating wealth summary: %w", err)
	}

	return summaries, nil
}

// GetUserWalletsWithCurrencyInfo retrieves all user wallets with detailed currency information
func (r *WalletRepositoryImpl) GetUserWalletsWithCurrencyInfo(ctx context.Context, userID uuid.UUID) ([]WalletWithCurrencyInfo, error) {
	query := `
		SELECT 
			w.id, 
			w.currency_id, 
			c.name, 
			w.available_balance, 
			w.locked_balance, 
			(w.available_balance + w.locked_balance) as total_balance,
			TO_CHAR(w.created_at, 'YYYY-MM-DD HH24:MI:SS')
		FROM wallets w
		LEFT JOIN currencies c ON w.currency_id = c.id
		WHERE w.user_id = $1
		ORDER BY w.created_at ASC
	`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query wallets with currency info: %w", err)
	}
	defer rows.Close()

	var walletInfos []WalletWithCurrencyInfo
	for rows.Next() {
		var info WalletWithCurrencyInfo
		var currencyName sql.NullString

		err := rows.Scan(
			&info.WalletID,
			&info.CurrencyID,
			&currencyName,
			&info.AvailableBalance,
			&info.LockedBalance,
			&info.TotalBalance,
			&info.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan wallet with currency info: %w", err)
		}

		if currencyName.Valid {
			info.CurrencyName = currencyName.String
		} else {
			info.CurrencyName = info.CurrencyID // Fallback to ID if name not found
		}

		walletInfos = append(walletInfos, info)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating wallet info: %w", err)
	}

	return walletInfos, nil
}
