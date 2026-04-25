package transport

import (
	"net/http"
	"strings"

	"backend/internal/auth"
	"github.com/gin-gonic/gin"
)

const (
	
	UserIDKey = "userID"
	
	UsernameKey = "username"
)


func AuthMiddleware(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		
		authHeader := ctx.GetHeader("Authorization")
		if authHeader == "" {
			ctx.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: "missing authorization header",
			})
			ctx.Abort()
			return
		}

		
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			ctx.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: "invalid authorization header format",
			})
			ctx.Abort()
			return
		}

		tokenString := parts[1]

		
		claims, err := authService.VerifyToken(tokenString)
		if err != nil {
			ctx.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: "invalid or expired token",
			})
			ctx.Abort()
			return
		}

		
		ctx.Set(UserIDKey, claims.UserID)
		ctx.Set(UsernameKey, claims.Username)

		
		ctx.Next()
	}
}



func GetUserID(ctx *gin.Context) (string, bool) {
	userID, exists := ctx.Get(UserIDKey)
	if !exists {
		return "", false
	}
	id, ok := userID.(string)
	return id, ok
}



func GetUsername(ctx *gin.Context) (string, bool) {
	username, exists := ctx.Get(UsernameKey)
	if !exists {
		return "", false
	}
	name, ok := username.(string)
	return name, ok
}
