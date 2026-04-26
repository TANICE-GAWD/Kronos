package transport

import (
	"net/http"
	"strings"

	"backend/internal/auth"
	"backend/internal/repository"
	"github.com/gin-gonic/gin"
)


type RegisterRequest struct {
	Username   string `json:"username" binding:"required,min=3,max=255"`
	Password   string `json:"password" binding:"required,min=8"`
	HomePlanet string `json:"home_planet" binding:"required,min=1,max=100"`
}


type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}


type AuthResponse struct {
	Message string `json:"message"`
	UserID  string `json:"user_id,omitempty"`
}


type TokenResponse struct {
	Token  string `json:"token"`
	Expiry string `json:"expiry"`
}


type ErrorResponse struct {
	Error string `json:"error"`
}


func RegisterHandler(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req RegisterRequest

		
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, ErrorResponse{
				Error: "Invalid request: " + err.Error(),
			})
			return
		}

		
		req.Username = strings.TrimSpace(req.Username)
		req.HomePlanet = strings.TrimSpace(req.HomePlanet)

		
		err := authService.Register(ctx.Request.Context(), req.Username, req.Password, req.HomePlanet)
		if err != nil {
			
			if strings.Contains(err.Error(), "username already exists") {
				ctx.JSON(http.StatusConflict, ErrorResponse{
					Error: "Username already exists",
				})
				return
			}

			
			ctx.JSON(http.StatusBadRequest, ErrorResponse{
				Error: "Registration failed: " + err.Error(),
			})
			return
		}

		
		ctx.JSON(http.StatusCreated, gin.H{
			"message": "User registered successfully",
		})
	}
}


func LoginHandler(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req LoginRequest

		
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, ErrorResponse{
				Error: "Invalid request: " + err.Error(),
			})
			return
		}

		
		req.Username = strings.TrimSpace(req.Username)

		
		token, user, err := authService.Login(ctx.Request.Context(), req.Username, req.Password)
		if err != nil {
			
			ctx.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: "Invalid username or password",
			})
			return
		}

		
		ctx.JSON(http.StatusOK, gin.H{
			"token":       token,
			"expiry":      "24h",
			"user_id":     user.ID.String(),
			"username":    user.Username,
			"home_planet": user.HomePlanet,
		})
	}
}

// SearchHandler allows users to search for other users by username prefix
func SearchHandler(userRepository repository.UserRepository) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		query := ctx.Query("q")

		if query == "" {
			ctx.JSON(http.StatusBadRequest, ErrorResponse{
				Error: "Search query parameter 'q' is required",
			})
			return
		}

		// Search for users (limit to 5 results)
		users, err := userRepository.SearchUsersByUsername(ctx.Request.Context(), query, 5)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, ErrorResponse{
				Error: "Search failed: " + err.Error(),
			})
			return
		}

		// Return only username and home_planet for privacy/security
		results := make([]gin.H, 0)
		for _, user := range users {
			results = append(results, gin.H{
				"username":    user.Username,
				"home_planet": user.HomePlanet,
			})
		}

		ctx.JSON(http.StatusOK, gin.H{
			"results": results,
		})
	}
}
