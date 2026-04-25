package transport

import(
	"context"
	"backend/internal/models/packet"
	"backend/internal/repository"
	"github.com/google/uuid"
	"log"
)

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
			// Enrich state with wallet, transaction, and user data
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

// EnrichState fetches and adds wallet, transaction, and user data to the state update
func (h *Hub) EnrichState(state packet.StateUpdate) packet.StateUpdate {
	ctx := context.Background()
	
	// Fetch all wallets
	wallets, err := h.walletRepo.GetAllWallets(ctx)
	if err != nil {
		log.Printf("[Hub] Error fetching wallets: %v", err)
	} else {
		walletsMap := make(map[string]interface{})
		for _, w := range wallets {
			userKey := w.UserID.String()
			walletsMap[userKey] = map[string]interface{}{
				"id":                w.ID.String(),
				"user_id":           w.UserID.String(),
				"currency_id":       w.CurrencyID,
				"available_balance": w.AvailableBalance,
				"locked_balance":    w.LockedBalance,
				"created_at":        w.CreatedAt,
				"updated_at":        w.UpdatedAt,
			}
		}
		state.Wallets = walletsMap
	}
	
	// Fetch all transactions
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
	
	// Fetch all users
	users, err := h.userRepo.GetAllUsers(ctx)
	if err != nil {
		log.Printf("[Hub] Error fetching users: %v", err)
	} else {
		usersMap := make(map[uuid.UUID]map[string]interface{})
		for _, u := range users {
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
	
	return state
}
