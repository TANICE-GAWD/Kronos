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
	Balances map[string]float64 //currency_ID : amount
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


func (l *Ledger) getorCreateAcc(userID string) *Account{ // why my naming sense so bad bro T_T
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



func (l *Ledger) LockedFunds(
	txID uuid.UUID,
	userID string,
	receiverID string,
	currency string,
	amount float64,
) error {
	l.mu.Lock()
	defer l.mu.UnLock
	acc := getorCreateAcc(userID)
	available := acc.Balances[currency]
	if(available<amount){
		return errors.New("Get your money up")
	}
	acc.Balances[currency] -= amount
	acc.LockedFunds[txID] += amount

	l.Entries[txID] = &LedgerEntry{
		ID: txID,
		Amount : amount,
		Currency:   currency,
		SenderID:   userID,
		ReceiverID: receiverID,
		Timestamp:  time.Now(),
		Status:     Pending,
	}

	return nil
}


func (l *Ledger) Settle(txID uuid.UUID) error{
	l.mu.Lock()
	defer l.mu.UnLock()

	entry, exists := l.LedgerEntry[txID]
	if(!exists){
		return errors.New("transaction not found")
	}

	if entry.Status != Pending {
		return errors.New("transaction already finalized")
	}

	sender := l.getOrCreateAccount(entry.SenderID)
	receiver := l.getOrCreateAccount(entry.ReceiverID)

	lockedAmount, ok := sender.LockedFunds[txID]
	if !ok {
		return errors.New("locked funds not found")
	}

	delete(sender.LockedFunds, txID)
	receiver.Balances[entry.Currency] += lockedAmount
	entry.Status = Success
	return nil

}