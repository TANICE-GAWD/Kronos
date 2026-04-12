package transport

import (
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"backend/internal/engine"
	"backend/internal/finance"
	"backend/internal/models/packet"
)

type TransferRequest struct {
	OriginPlanet      string  `json:"origin_planet" binding:"required"`
	DestinationPlanet string  `json:"destination_planet" binding:"required"`
	Amount            float64 `json:"amount" binding:"required,gt=0"`
	CurrencyID        string  `json:"currency_id" binding:"required"`
}

func TransferHandler(ctx *gin.Context, scheduler *engine.Scheduler) gin.HandlerFunc {
	var req TransferRequest
	if err := ctx.ShouldBindJSON(&req); err != nil{
		ctx.JSON(http.StatusBadRequest, gin.H{"error" : err.Error()})
		return
	}

	now := time.Now()
	txID := uuid.New()

	err := ledger.LockFunds(
		txID,
		req.OriginPlanet,
		req.DestinationPlanet,
		req.CurrencyID,
		req.Amount,
	)

	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Insufficient Star Credits",
		})
		return
	}

	// originPlanet, ok := engine.GetPlanet(req.OriginPlanet)
	// if !ok {
	// 	ctx.JSON(http.StatusBadRequest, gin.H{"error": "unknown origin planet"})
	// 	return
	// }

	// destPlanet, ok := engine.GetPlanet(req.DestinationPlanet)
	// if !ok {
	// 	ctx.JSON(http.StatusBadRequest, gin.H{"error": "unknown destination planet"})
	// 	return
	// }

	originPos, ok := engine.GetPlanetPosition(req.OriginPlanet, now)
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "unknown origin planet"})
		return
	}

	destPos, ok := engine.GetPlanetPosition(req.DestinationPlanet, now)
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "unknown destination planet"})
		return
	}


	p := &packet.Packet{
		ID: txID,
		Start: originPos,
		End: destPos,
		DestinationPlanet: req.DestinationPlanet,
		CurrentPos: originPos,
		Payload: packet.Payload{
			Amount: req.Amount,
			CurrencyID: req.CurrencyID,
		},
		LaunchTime: time.Now(),
		Status: packet.Active,
		DilationFactor: 1.0,
		Velocity: SpeedOfLight,
	}

	scheduler.AddPacket(p)
	ctx.JSON(http.StatusOK, gin.H{"id" : id, "status" : "active"})
}



func BalanceHandler(ledger *finance.Ledger) gin.HandlerFunc {

	return func(ctx *gin.Context) {

		userID := ctx.Param("userID")

		ledger.mu.RLock() 
		acc, exists := ledger.Accounts[userID]
		ledger.mu.RUnlock()

		if !exists {
			ctx.JSON(http.StatusNotFound, gin.H{
				"error": "account not found",
			})
			return
		}

		escrow := make(map[string]float64)

		for _, entry := range acc.LockedFunds {
			escrow["total"] += entry
		}

		ctx.JSON(http.StatusOK, gin.H{
			"user":      userID,
			"available": acc.Balances,
			"escrow":    escrow,
		})
	}
}


func HistoryHandler(ledger *finance.Ledger) gin.HandlerFunc {

	return func(ctx *gin.Context) {

		userID := ctx.Param("userID")

		ledger.mu.RLock()
		defer ledger.mu.RUnlock()

		history := []finance.LedgerEntry{}

		for _, entry := range ledger.Entries {

			if entry.SenderID == userID || entry.ReceiverID == userID {
				history = append(history, *entry)
			}
		}

		sort.Slice(history, func(i, j int) bool {
			return history[i].Timestamp.After(history[j].Timestamp)
		})

		ctx.JSON(http.StatusOK, history)
	}
}