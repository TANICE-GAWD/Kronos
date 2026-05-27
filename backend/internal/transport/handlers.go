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

func planetCurrencyID(planetName string) string {
	
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
		effectiveCurrencyID := strings.ToUpper(strings.TrimSpace(req.CurrencyID))
		receiverCurrencyID := planetCurrencyID(receiverHomePlanet)

		
		if senderID == receiverID {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "cannot transfer to yourself"})
			return
		}

		log.Printf("[Transfer] Receiver %s is from planet %s", receiverID, receiverHomePlanet)

		
		
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

		
		senderWallet, err := walletRepo.GetWalletByUserIDAndCurrency(ctx, senderID, effectiveCurrencyID)
		if err != nil || senderWallet == nil {
			allWallets, listErr := walletRepo.GetAllWallets(ctx)
			if listErr != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve sender wallet"})
				return
			}

			for _, w := range allWallets {
				if w.UserID == senderID && w.AvailableBalance >= req.Amount {
					senderWallet = w
					break
				}
			}

			if senderWallet == nil {
				for _, w := range allWallets {
					if w.UserID == senderID {
						senderWallet = w
						break
					}
				}
			}

			if senderWallet == nil {
				ctx.JSON(http.StatusBadRequest, gin.H{"error": "sender does not have any wallet"})
				return
			}

			effectiveCurrencyID = senderWallet.CurrencyID
			log.Printf("[Transfer] Fallback currency selected for sender %s: %s", senderID, effectiveCurrencyID)
		}

		receiverWallet, err := walletRepo.GetWalletByUserIDAndCurrency(ctx, receiverID, receiverCurrencyID)
		if err != nil || receiverWallet == nil {
			receiverWallet = &models.Wallet{
				UserID:           receiverID,
				CurrencyID:       receiverCurrencyID,
				AvailableBalance: 0,
				LockedBalance:    0,
				CreatedAt:        now,
				UpdatedAt:        now,
			}

			createErr := walletRepo.CreateWallet(ctx, receiverWallet)
			if createErr != nil {
				refetch, fetchErr := walletRepo.GetWalletByUserIDAndCurrency(ctx, receiverID, receiverCurrencyID)
				if fetchErr != nil || refetch == nil {
					ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare receiver wallet"})
					return
				}
				receiverWallet = refetch
			}
		}

		if senderWallet.AvailableBalance < req.Amount {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "insufficient balance"})
			return
		}

		log.Printf("[Transfer] Sender has sufficient balance: %f %s available", senderWallet.AvailableBalance, effectiveCurrencyID)

		
		txID := uuid.New()
		err = walletRepo.LockFundsInWallet(ctx, senderWallet.ID, req.Amount)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "failed to lock funds: " + err.Error()})
			return
		}

		log.Printf("[Transfer] Funds locked in database: %f %s from wallet %s", req.Amount, effectiveCurrencyID, senderWallet.ID)

		
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
				CurrencyID: receiverCurrencyID,
				SenderWalletID: senderWallet.ID,
				ReceiverWalletID: receiverWallet.ID,
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
			"currency":  receiverCurrencyID,
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

// GetUserWealthHandler returns user's wealth summary across all currencies
func GetUserWealthHandler(walletRepo repository.WalletRepository) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userIDStr, ok := GetUserID(ctx)
		if !ok {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: missing user ID"})
			return
		}

		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user ID format"})
			return
		}

		log.Printf("[GetWealth] Retrieving wealth summary for user %s", userID)

		summaries, err := walletRepo.GetUserWealthSummary(ctx, userID)
		if err != nil {
			log.Printf("[GetWealth] Error: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve wealth summary"})
			return
		}

		if len(summaries) == 0 {
			ctx.JSON(http.StatusOK, gin.H{
				"user_id":    userID,
				"currencies": []interface{}{},
				"total":      0.0,
			})
			return
		}

		// Calculate total wealth
		var totalWealth float64
		for _, summary := range summaries {
			totalWealth += summary.TotalBalance
		}

		ctx.JSON(http.StatusOK, gin.H{
			"user_id":    userID,
			"currencies": summaries,
			"total":      totalWealth,
		})
	}
}

// GetUserTransactionHistoryHandler returns the current user's transaction history via v_user_transaction_history
func GetUserTransactionHistoryHandler(transactionRepo repository.TransactionRepository) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userIDStr, ok := GetUserID(ctx)
		if !ok {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: missing user ID"})
			return
		}
		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user ID format"})
			return
		}
		records, err := transactionRepo.GetUserTransactionHistory(ctx, userID)
		if err != nil {
			log.Printf("[TxHistory] Error for user %s: %v", userID, err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve transaction history"})
			return
		}
		if records == nil {
			records = []repository.UserTransactionRecord{}
		}
		ctx.JSON(http.StatusOK, gin.H{
			"user_id":      userID,
			"transactions": records,
			"count":        len(records),
		})
	}
}

// GetTransactionStatusHistoryHandler returns the status-change audit trail for one transaction
// via v_transaction_status_history
func GetTransactionStatusHistoryHandler(transactionRepo repository.TransactionRepository) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		txIDStr := ctx.Param("txID")
		txID, err := uuid.Parse(txIDStr)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid transaction ID"})
			return
		}
		records, err := transactionRepo.GetTransactionStatusHistory(ctx, txID)
		if err != nil {
			log.Printf("[TxStatusHistory] Error for tx %s: %v", txID, err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve status history"})
			return
		}
		if records == nil {
			records = []repository.StatusHistoryRecord{}
		}
		ctx.JSON(http.StatusOK, gin.H{
			"transaction_id": txID,
			"history":        records,
		})
	}
}

// GetUserWalletsDetailedHandler returns user's wallets with detailed currency information
func GetUserWalletsDetailedHandler(walletRepo repository.WalletRepository) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userIDStr, ok := GetUserID(ctx)
		if !ok {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: missing user ID"})
			return
		}

		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user ID format"})
			return
		}

		log.Printf("[GetWalletsDetailed] Retrieving detailed wallets for user %s", userID)

		walletInfos, err := walletRepo.GetUserWalletsWithCurrencyInfo(ctx, userID)
		if err != nil {
			log.Printf("[GetWalletsDetailed] Error: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve wallet information"})
			return
		}

		if len(walletInfos) == 0 {
			ctx.JSON(http.StatusOK, gin.H{
				"user_id":  userID,
				"wallets":  []interface{}{},
				"total":    0.0,
				"currency_count": 0,
			})
			return
		}

		// Calculate total wealth and count unique currencies
		var totalWealth float64
		currencyMap := make(map[string]bool)
		for _, wallet := range walletInfos {
			totalWealth += wallet.TotalBalance
			currencyMap[wallet.CurrencyID] = true
		}

		ctx.JSON(http.StatusOK, gin.H{
			"user_id":          userID,
			"wallets":          walletInfos,
			"total":            totalWealth,
			"currency_count":   len(currencyMap),
		})
	}
}