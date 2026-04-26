package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"backend/internal/auth"
	"backend/internal/engine"
	"backend/internal/finance"
	"backend/internal/models/packet"
	"backend/internal/repository"
	"backend/internal/transport"
)

var BlackHole = packet.Point{X: 0, Y: 0, Z: 100}

func main() {
	
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, using system environment variables")
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "your-secret-key-change-in-production" 
		log.Println("Warning: JWT_SECRET not set, using insecure default")
	}

	
	postgresRepo, err := repository.NewPostgresRepository(databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer postgresRepo.Close()
	log.Println("✓ Database connected successfully")

	
	db := postgresRepo.GetDB()
	userRepository := repository.NewUserRepository(db)
	walletRepository := repository.NewWalletRepository(db)
	transactionRepository := repository.NewTransactionRepository(db)
	log.Println("✓ Repositories initialized")

	
	authService := auth.NewAuthService(userRepository, walletRepository, jwtSecret)
	log.Println("✓ Auth service initialized")

	
	ledger := finance.NewLedger()
	finance.SeedLedger(ledger)
	log.Println("✓ Ledger initialized")

	hub := transport.NewHub(walletRepository, transactionRepository, userRepository)
	scheduler := engine.NewScheduler(BlackHole, ledger, transactionRepository)
	stop := make(chan struct{})
	log.Println("✓ Engine components initialized")

	
	go hub.Run()
	go scheduler.Start(stop)
	log.Println("✓ Hub and scheduler started")

	
	go func() {
		for stateSnapshot := range scheduler.UpdateChan {
			hub.Broadcast(stateSnapshot)
		}
	}()

	
	r := gin.Default()
	
	
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
	
	log.Println("✓ Gin router initialized with CORS enabled")

	
	public := r.Group("/api")
	{
		public.POST("/register", transport.RegisterHandler(authService))
		public.POST("/login", transport.LoginHandler(authService))
	}
	log.Println("✓ Public routes registered: /api/register, /api/login")

	
	protected := r.Group("/api")
	protected.Use(transport.AuthMiddleware(authService))
	{
		protected.POST("/transfer", transport.TransferHandler(scheduler, ledger, userRepository, walletRepository, transactionRepository))
		protected.GET("/balance/:userID", transport.BalanceHandler(ledger))
		protected.GET("/history/:userID", transport.HistoryHandler(ledger))
	}
	log.Println("✓ Protected routes registered: /api/transfer, /api/balance, /api/history")

	
	r.GET("/ws", func(ctx *gin.Context) {
		currentState := scheduler.GetState()
		transport.ServeWS(ctx, "client", hub, currentState)
	})
	log.Println("✓ WebSocket route registered: /ws")

	
	fmt.Println("\n🚀 Kronos Backend API Server Starting on :8080")
	fmt.Println("   Database: Connected to PostgreSQL")
	fmt.Println("   Auth: JWT-based authentication enabled")
	fmt.Println("   Routes: Public (/api/register, /api/login) + Protected + WebSocket")
	fmt.Println()

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}