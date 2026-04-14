package finance

import(

	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// need a triple state ledger >> Available, In-Flight, Settled
// delete
func SeedLedger(l *Ledger) {

	l.Credit(10000, "GAL-CR", "earth")
	l.Credit(10000, "GAL-CR", "mars")
	l.Credit(5000, "GAL-CR", "venus")
	l.Credit(2000, "GAL-CR", "jupiter")
}

type TxStatus string


const(
	Pending TxStatus = "pending"
	Success TxStatus = "success"
	Failed  TxStatus = "failed"
)


type Account struct{
	UserID string `json:"id"` // string coz it will be planet names
	Balances map[string]float64 `json:"balances"` //currency_ID : amount
	LockedFunds map[uuid.UUID]float64 `json:"lockedfunds"`
}


type LedgerEntry struct{
	ID uuid.UUID `json:"id"`
	Amount float64 `json:"amount"`
	Currency string `json:"currency"`
	SenderID string `json:"senderid"`
	ReceiverID string `json:"receiverid"`
	Timestamp time.Time `json:"timestamp"`
	Status TxStatus `json:"status"`
}


type Ledger struct{
	Accounts map[string]*Account `json:"accounts"`
	Entries map[uuid.UUID]*LedgerEntry `json:"entries"`
	mu sync.RWMutex
}


func NewLedger() *Ledger {
	return &Ledger{
		Accounts: make(map[string]*Account),
		Entries:  make(map[uuid.UUID]*LedgerEntry),
	}
}


func (l *Ledger) getOrCreateAcc(userID string) *Account{ // why my naming sense so bad bro T_T
	acc,exists := l.Accounts[userID]
	if !exists{
		acc = &Account{
			UserID : userID,
			Balances :make(map[string]float64),
			LockedFunds : make(map[uuid.UUID]float64),
		}
		l.Accounts[userID] = acc
	}

	return acc
}



func (l *Ledger) LockFunds(
	txID uuid.UUID,
	userID string,
	receiverID string,
	currency string,
	amount float64,
) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	acc := l.getOrCreateAcc(userID)
	available := acc.Balances[currency]
	if(available<amount){
		return errors.New("insufficient balance")
	}
	acc.Balances[currency] -= amount
	acc.LockedFunds[txID] = amount

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
	defer l.mu.Unlock()

	entry, exists := l.Entries[txID]
	if(!exists){
		return errors.New("transaction not found")
	}

	if entry.Status != Pending {
		return errors.New("transaction already finalized")
	}

	sender := l.getOrCreateAcc(entry.SenderID)
	receiver := l.getOrCreateAcc(entry.ReceiverID)

	lockedAmount, ok := sender.LockedFunds[txID]
	if !ok {
		return errors.New("locked funds not found")
	}

	delete(sender.LockedFunds, txID)
	receiver.Balances[entry.Currency] += lockedAmount
	entry.Status = Success
	return nil

}

func (l *Ledger) Void(txID uuid.UUID) error{
	l.mu.Lock()
	defer l.mu.Unlock()
	entry, exists := l.Entries[txID]
	if(!exists){
		return errors.New("transaction not found")
	}
	if entry.Status != Pending {
		return errors.New("transaction already finalized")
	}

	sender := l.getOrCreateAcc(entry.SenderID)
	lockedAmount, ok := sender.LockedFunds[txID]
	if !ok {
		return errors.New("locked funds not found")
	}

	delete(sender.LockedFunds, txID)
	sender.Balances[entry.Currency] += lockedAmount
	entry.Status = Failed
	return nil


}


func (l *Ledger) Credit(amount float64, currency string, userID string){
	l.mu.Lock()
	defer l.mu.Unlock()
	acc := l.getOrCreateAcc(userID)
	acc.Balances[currency] += amount
}


func (l *Ledger) GetBalance(userID string, currency string) (float64, error) {

	l.mu.RLock()
	defer l.mu.RUnlock()

	acc, exists := l.Accounts[userID]
	if !exists {
		return 0, errors.New("account not found") 
	}

	balance, ok := acc.Balances[currency]
	if !ok {
		return 0, nil 
	}

	return balance, nil
}


// these 2 func is to help handler func of balacne and history in handler.go
func (l *Ledger) GetAccountSnapshot(userID string) (map[string]float64, float64, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	acc, exists := l.Accounts[userID]
	if !exists {
		return nil, 0, errors.New("account not found")
	}

	var escrow float64
	for _, amount := range acc.LockedFunds {
		escrow += amount
	}

	return acc.Balances, escrow, nil
}

func (l *Ledger) GetHistory(userID string) []LedgerEntry {
	l.mu.RLock()
	defer l.mu.RUnlock()

	history := []LedgerEntry{}

	for _, entry := range l.Entries {
		if entry.SenderID == userID || entry.ReceiverID == userID {
			history = append(history, *entry)
		}
	}

	return history
}