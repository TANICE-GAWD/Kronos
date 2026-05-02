package auth

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend/internal/models"
	"backend/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)


func getPlanetCurrencyID(planetName string) string {
	
	planetToCurrency := map[string]string{
		"earth":         "EARTH",
		"mars":          "MARS",
		"venus":         "VENUS",
		"jupiter":       "JUPITER",
		"saturn":        "SATURN",
		"mercury":       "MERCURY",
		"moon":          "MOON",
		"asteroid":      "ASTEROID",
		"asteroid belt": "ASTEROID",
	}

	normalizedPlanet := strings.ToLower(strings.TrimSpace(planetName))

	if currencyID, exists := planetToCurrency[normalizedPlanet]; exists {
		return currencyID
	}

	
	return strings.ToUpper(planetName)
}


type AuthService struct {
	userRepo   repository.UserRepository
	walletRepo repository.WalletRepository
	jwtSecret  string
}


type AuthClaims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}


func NewAuthService(userRepo repository.UserRepository, walletRepo repository.WalletRepository, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:   userRepo,
		walletRepo: walletRepo,
		jwtSecret:  jwtSecret,
	}
}


func (as *AuthService) Register(ctx context.Context, username, password, homePlanet string) error {
	
	if username == "" || password == "" || homePlanet == "" {
		return fmt.Errorf("username, password, and home_planet cannot be empty")
	}

	
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	
	now := time.Now()
	user := &models.User{
		Username:     username,
		PasswordHash: string(passwordHash),
		HomePlanet:   homePlanet,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	
	if err := as.userRepo.CreateUser(ctx, user); err != nil {
		return fmt.Errorf("failed to register user: %w", err)
	}

	
	wallet := &models.Wallet{
		UserID:           user.ID,
		CurrencyID:       getPlanetCurrencyID(homePlanet), 
		AvailableBalance: 1000,      
		LockedBalance:    0,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := as.walletRepo.CreateWallet(ctx, wallet); err != nil {
		return fmt.Errorf("failed to initialize user wallet: %w", err)
	}

	return nil
}


func (as *AuthService) Login(ctx context.Context, username, password string) (string, *models.User, error) {
	
	if username == "" || password == "" {
		return "", nil, fmt.Errorf("username and password are required")
	}

	
	user, err := as.userRepo.GetUserByUsername(ctx, username)
	if err != nil {
		return "", nil, fmt.Errorf("invalid username or password")
	}

	
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", nil, fmt.Errorf("invalid username or password")
	}

	
	token, err := as.generateToken(user)
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return token, user, nil
}


func (as *AuthService) generateToken(user *models.User) (string, error) {
	
	expirationTime := time.Now().Add(24 * time.Hour)

	claims := &AuthClaims{
		UserID:   user.ID.String(),
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	
	tokenString, err := token.SignedString([]byte(as.jwtSecret))
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}


func (as *AuthService) VerifyToken(tokenString string) (*AuthClaims, error) {
	claims := &AuthClaims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(as.jwtSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}
