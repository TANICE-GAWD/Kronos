package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"backend/internal/models"
	"github.com/google/uuid"
)


type UserRepository interface {
	CreateUser(ctx context.Context, user *models.User) error
	GetUserByUsername(ctx context.Context, username string) (*models.User, error)
	GetUserByID(ctx context.Context, userID uuid.UUID) (*models.User, error)
	GetAllUsers(ctx context.Context) ([]*models.User, error)
	SearchUsersByUsername(ctx context.Context, prefix string, limit int) ([]*models.User, error)
}


type UserRepositoryImpl struct {
	db *sql.DB
}


func NewUserRepository(db *sql.DB) UserRepository {
	return &UserRepositoryImpl{db: db}
}


func (r *UserRepositoryImpl) CreateUser(ctx context.Context, user *models.User) error {
	
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}

	query := `
		INSERT INTO users (id, username, password_hash, home_planet, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		user.ID,
		user.Username,
		user.PasswordHash,
		user.HomePlanet,
		sql.NullTime{Valid: true, Time: user.CreatedAt},
		sql.NullTime{Valid: true, Time: user.UpdatedAt},
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		
		if err.Error() == "pq: duplicate key value violates unique constraint \"users_username_key\"" {
			return fmt.Errorf("username already exists: %w", err)
		}
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}


func (r *UserRepositoryImpl) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	query := `
		SELECT id, username, password_hash, home_planet, created_at, updated_at
		FROM users
		WHERE username = $1
	`

	user := &models.User{}
	err := r.db.QueryRowContext(ctx, query, username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.HomePlanet,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("user not found: %w", err)
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}


func (r *UserRepositoryImpl) GetUserByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	query := `
		SELECT id, username, password_hash, home_planet, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	user := &models.User{}
	err := r.db.QueryRowContext(ctx, query, userID).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.HomePlanet,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("user not found: %w", err)
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}


func (r *UserRepositoryImpl) GetAllUsers(ctx context.Context) ([]*models.User, error) {
	query := `
		SELECT id, username, password_hash, home_planet, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query users: %w", err)
	}
	defer rows.Close()

	users := []*models.User{}
	for rows.Next() {
		user := &models.User{}
		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.PasswordHash,
			&user.HomePlanet,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating users: %w", err)
	}

	return users, nil
}


func (r *UserRepositoryImpl) SearchUsersByUsername(ctx context.Context, prefix string, limit int) ([]*models.User, error) {
	if limit <= 0 {
		limit = 5 
	}
	
	query := `
		SELECT id, username, password_hash, home_planet, created_at, updated_at
		FROM users
		WHERE username ILIKE $1
		ORDER BY username ASC
		LIMIT $2
	`

	rows, err := r.db.QueryContext(ctx, query, prefix+"%", limit)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer rows.Close()

	users := []*models.User{}
	for rows.Next() {
		user := &models.User{}
		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.PasswordHash,
			&user.HomePlanet,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating users: %w", err)
	}

	return users, nil
}
