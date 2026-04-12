package finance

import(
	"fmt"
	"uuid"
	"backend/internal/models/packet"
)

// need a triple state ledger >> Available, In-Flight, Settled

type TxStatus string

const(
	Pending TxStatus = "pending"
	Success TxStatus = "success"
	Failed  TxStatus = "failed"
)

type Account struct{
	UserID uuid `json: "id"`
	Balances map[string]float64
	LockedFunds map[uuid.UUID]float64
}


type LedgerEntry struct{
	ID uuid 
	Amount float64
	Currency string
	SenderID string
	ReceiverID string
	Timestamp time.Time
	Status TxStatus
}


type Ledger struct{
	Accounts map[string]*Account
	Entries map[string]*LedgerEntry
	mu sync.RWMutex
}


func NewLedger() *Ledger {
	return &Ledger{
		Accounts: make(map[string]*Account),
		Entries:  make(map[uuid.UUID]*LedgerEntry),
	}
}
// for the ledger method to add or create

func (l *Ledger) getorCreateAcc(userID string) *Account{
	acc,exists := l.Accounts[userID]
	if !exists{
		acc := &Account{
			UserID : userID,
			Balances :make(map[string]float64),
			LockedFunds : make(map[uuid.UUID]float64),
		}
		l.Accounts[userID] = acc
	}

	return acc
}



func LockFunds(u UserID, amount Amount, currency Packet.CurrencyID){
	Available := Account.Balances[currency]
	if(Available >= amount){
		Available -= amount
		Account.LockedFunds[currency] += amount
	}

}

func Settle(sender SenderID, receiver ReceiverID, amount Amount, currency Packet.CurrencyID){
	LockedFunds[currency]
}