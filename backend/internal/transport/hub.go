package transport

import(
	"context"
	"backend/internal/models/packet"
	"backend/internal/repository"
	"github.com/google/uuid"
	"log"
	"strings"
	"time"
)

func planetCurrencyIDForHub(planetName string) string {
	// Map planet names to their corresponding currency IDs in the database
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

	// Fallback: if planet not found, use uppercase planet name (for extensibility)
	return strings.ToUpper(planetName)
}

type Hub struct{
	register chan *Client
	unregister chan *Client
	clients map[*Client]bool
	broadcast chan packet.StateUpdate
	walletRepo repository.WalletRepository
	transactionRepo repository.TransactionRepository
	userRepo repository.UserRepository
}

func NewHub(walletRepo repository.WalletRepository, transactionRepo repository.TransactionRepository, userRepo repository.UserRepository) *Hub{
	return &Hub{
		clients: make(map[*Client]bool),
		register: make(chan *Client),
		unregister: make(chan *Client),
		broadcast: make(chan packet.StateUpdate),
		walletRepo: walletRepo,
		transactionRepo: transactionRepo,
		userRepo: userRepo,
	}
}



func (h *Hub) Run(){
	for{
		select{
		case client := <- h.register:
			h.clients[client] = true;
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
			}
		case stateSnapshot := <-h.broadcast:
			
			enrichedState := h.EnrichState(stateSnapshot)
			
			for client := range h.clients {
				select {
				case client.send <- enrichedState:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}

}

func (h *Hub) Broadcast(state packet.StateUpdate) {
	h.broadcast <- state
}


func (h *Hub) EnrichState(state packet.StateUpdate) packet.StateUpdate {
	ctx := context.Background()

	userPlanetCurrency := make(map[string]string)
	usersMap := make(map[uuid.UUID]map[string]interface{})

	
	users, err := h.userRepo.GetAllUsers(ctx)
	if err != nil {
		log.Printf("[Hub] Error fetching users: %v", err)
	} else {
		for _, u := range users {
			userPlanetCurrency[u.ID.String()] = planetCurrencyIDForHub(u.HomePlanet)
			usersMap[u.ID] = map[string]interface{}{
				"id":          u.ID.String(),
				"username":    u.Username,
				"home_planet": u.HomePlanet,
				"created_at":  u.CreatedAt,
				"updated_at":  u.UpdatedAt,
			}
		}
		state.Users = usersMap
	}
	
	
	wallets, err := h.walletRepo.GetAllWallets(ctx)
	if err != nil {
		log.Printf("[Hub] Error fetching wallets: %v", err)
	} else {
		selectedWalletByUser := make(map[string]interface{})
		selectedWalletMeta := make(map[string]struct {
			currencyID string
			updatedAt  time.Time
		})

		walletsMap := make(map[string]interface{})
		for _, w := range wallets {
			userKey := w.UserID.String()
			walletData := map[string]interface{}{
				"id":                w.ID.String(),
				"user_id":           w.UserID.String(),
				"currency_id":       w.CurrencyID,
				"available_balance": w.AvailableBalance,
				"locked_balance":    w.LockedBalance,
				"created_at":        w.CreatedAt,
				"updated_at":        w.UpdatedAt,
			}

			preferredCurrency := userPlanetCurrency[userKey]
			current, exists := selectedWalletMeta[userKey]
			if !exists {
				selectedWalletByUser[userKey] = walletData
				selectedWalletMeta[userKey] = struct {
					currencyID string
					updatedAt  time.Time
				}{
					currencyID: strings.ToUpper(strings.TrimSpace(w.CurrencyID)),
					updatedAt:  w.UpdatedAt,
				}
				continue
			}

			candidateCurrency := strings.ToUpper(strings.TrimSpace(w.CurrencyID))
			currentPreferred := current.currencyID == preferredCurrency
			candidatePreferred := candidateCurrency == preferredCurrency

			chooseCandidate := false
			if candidatePreferred && !currentPreferred {
				chooseCandidate = true
			} else if candidatePreferred == currentPreferred {
				if w.UpdatedAt.After(current.updatedAt) {
					chooseCandidate = true
				}
			}

			if chooseCandidate {
				selectedWalletByUser[userKey] = walletData
				selectedWalletMeta[userKey] = struct {
					currencyID string
					updatedAt  time.Time
				}{
					currencyID: candidateCurrency,
					updatedAt:  w.UpdatedAt,
				}
			}
		}

		for userKey, walletData := range selectedWalletByUser {
			walletsMap[userKey] = walletData
		}
		state.Wallets = walletsMap
	}
	
	
	transactions, err := h.transactionRepo.GetAllTransactions(ctx)
	if err != nil {
		log.Printf("[Hub] Error fetching transactions: %v", err)
	} else {
		txList := make([]map[string]interface{}, 0)
		for _, tx := range transactions {
			txList = append(txList, map[string]interface{}{
				"id":                  tx.ID.String(),
				"sender_id":           tx.SenderID.String(),
				"receiver_id":         tx.ReceiverID.String(),
				"amount":              tx.Amount,
				"status":              tx.Status,
				"origin_planet":       tx.OriginPlanet,
				"destination_planet": tx.DestinationPlanet,
				"created_at":          tx.CreatedAt,
				"updated_at":          tx.UpdatedAt,
			})
		}
		state.Transactions = txList
	}
	
	return state
}
