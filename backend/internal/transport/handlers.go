package transport

import (
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"backend/internal/engine"
	"backend/internal/finance"
	"backend/internal/models"
	"backend/internal/models/packet"
	"backend/internal/repository"
)

const(
	SpeedOfLight float64 = 50.0
)


type TransferRequest struct {
	ReceiverUsername  string  `json:"receiver_username" binding:"required,min=1"`
	Amount            float64 `json:"amount" binding:"required,gt=0"`
	CurrencyID        string  `json:"currency_id" binding:"required"`
}

func TransferHandler(
	scheduler *engine.Scheduler,
	ledger *finance.Ledger,
	userRepo repository.UserRepository,
	walletRepo repository.WalletRepository,
	transactionRepo repository.TransactionRepository,
) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req TransferRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		
		senderIDStr, ok := GetUserID(ctx)
		if !ok {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: missing user ID"})
			return
		}

		senderID, err := uuid.Parse(senderIDStr)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user ID format"})
			return
		}

		log.Printf("[Transfer] User %s initiating transfer", senderID)

		
		sender, err := userRepo.GetUserByID(ctx, senderID)
		if err != nil {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "sender account not found"})
			return
		}

		senderHomePlanet := sender.HomePlanet
		log.Printf("[Transfer] Sender %s is from planet %s", senderID, senderHomePlanet)

		
		receiverUsername := strings.TrimSpace(req.ReceiverUsername)
		receiver, err := userRepo.GetUserByUsername(ctx, receiverUsername)
		if err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "receiver not found"})
			return
		}

		receiverID := receiver.ID
		receiverHomePlanet := receiver.HomePlanet

		
		if senderID == receiverID {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "cannot transfer to yourself"})
			return
		}

		log.Printf("[Transfer] Receiver %s is from planet %s", receiverID, receiverHomePlanet)

		
		receiverWallet, err := walletRepo.GetWalletByUserIDAndCurrency(ctx, receiverID, req.CurrencyID)
		if err != nil || receiverWallet == nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "receiver does not have a wallet for this currency"})
			return
		}

		
		now := time.Now()
		originPos, ok := engine.GetPlanetPosition(senderHomePlanet, now)
		if !ok {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "sender's home planet not found in celestial map"})
			return
		}

		destPos, ok := engine.GetPlanetPosition(receiverHomePlanet, now)
		if !ok {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "receiver's home planet not found in celestial map"})
			return
		}

		
		senderWallet, err := walletRepo.GetWalletByUserIDAndCurrency(ctx, senderID, req.CurrencyID)
		if err != nil || senderWallet == nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "sender does not have a wallet for this currency"})
			return
		}

		if senderWallet.AvailableBalance < req.Amount {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "insufficient balance"})
			return
		}

		log.Printf("[Transfer] Sender has sufficient balance: %f %s available", senderWallet.AvailableBalance, req.CurrencyID)

		
		txID := uuid.New()
		err = walletRepo.LockFundsInWallet(ctx, senderWallet.ID, req.Amount)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "failed to lock funds: " + err.Error()})
			return
		}

		log.Printf("[Transfer] Funds locked in database: %f %s from wallet %s", req.Amount, req.CurrencyID, senderWallet.ID)

		
		transaction := &models.Transaction{
			ID:                txID,
			SenderID:          senderID,
			ReceiverID:        receiverID,
			Amount:            req.Amount,
			Status:            models.TransactionPending,
			OriginPlanet:      senderHomePlanet,
			DestinationPlanet: receiverHomePlanet,
			CreatedAt:         now,
			UpdatedAt:         now,
		}

		err = transactionRepo.CreateTransaction(ctx, transaction)
		if err != nil {
			
			
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create transaction record"})
			return
		}

		log.Printf("[Transfer] Transaction record created: %s", txID)

		
		p := &packet.Packet{
			ID:                txID,
			SenderID:          senderID,
			ReceiverID:        receiverID,
			Start:             originPos,
			End:               destPos,
			OriginPlanet:      senderHomePlanet,
			DestinationPlanet: receiverHomePlanet,
			CurrentPos:        originPos,
			Payload: packet.Payload{
				Amount:     req.Amount,
				CurrencyID: req.CurrencyID,
			},
			LaunchTime:     now,
			Status:         packet.Active,
			DilationFactor: 1.0,
			Velocity:       SpeedOfLight,
		}

		scheduler.AddPacket(p)
		log.Printf("[Transfer] Packet launched: %s from %s to %s", txID, senderHomePlanet, receiverHomePlanet)

		ctx.JSON(http.StatusOK, gin.H{
			"id":     txID,
			"status": "active",
			"sender": gin.H{
				"id":    senderID,
				"planet": senderHomePlanet,
			},
			"receiver": gin.H{
				"id":    receiverID,
				"planet": receiverHomePlanet,
			},
			"amount":    req.Amount,
			"currency":  req.CurrencyID,
		})
	}
}



func BalanceHandler(ledger *finance.Ledger) gin.HandlerFunc {

	return func(ctx *gin.Context) {

		userID := ctx.Param("userID")

		balances, escrow, err := ledger.GetAccountSnapshot(userID)
		if err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		ctx.JSON(http.StatusOK, gin.H{
			"user":      userID,
			"available": balances,
			"escrow":    escrow,
		})
	}
}


func HistoryHandler(ledger *finance.Ledger) gin.HandlerFunc {

	return func(ctx *gin.Context) {

		userID := ctx.Param("userID")

		history := ledger.GetHistory(userID)

		sort.Slice(history, func(i, j int) bool {
			return history[i].Timestamp.After(history[j].Timestamp)
		})

		ctx.JSON(http.StatusOK, history)
	}
}