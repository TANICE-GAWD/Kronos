package engine


import(
	"context"
	"time"
	"backend/internal/models/packet"
	"backend/internal/finance"
	"backend/internal/repository"
	"sync"
	"github.com/google/uuid"
	"fmt"
	"log"
)

type Scheduler struct{
	ActivePackets map[uuid.UUID]*packet.Packet
	mu sync.RWMutex
	BlackHole packet.Point
	UpdateChan chan packet.StateUpdate 
	ledger *finance.Ledger
	transactionRepo repository.TransactionRepository
}


func NewScheduler(blackHole packet.Point, ledger *finance.Ledger, transactionRepo repository.TransactionRepository) *Scheduler {
	return &Scheduler{
		ActivePackets: make(map[uuid.UUID]*packet.Packet), 
		BlackHole:     blackHole,
		UpdateChan:    make(chan packet.StateUpdate, 16), 
		ledger : ledger,
		transactionRepo: transactionRepo,
	}
}

func (s *Scheduler) Start(stopChan <-chan struct{}){
	tick := time.NewTicker(time.Second/60)
	last := time.Now()

	defer tick.Stop()
	
	for {
		select{
		case <-tick.C:
			keysToDelete := []uuid.UUID{}
		
			now:= time.Now()
			deltaTime := now.Sub(last).Seconds()
			last = now
			s.mu.Lock()
			for key, p := range s.ActivePackets {

				RunPhysics(p, s.BlackHole, deltaTime)

				if p.Status == packet.Settled {
					
					err := s.settleTransaction(p)
					if err != nil {
						
						log.Printf("[Scheduler] Settlement error for packet %s: %v", key, err)
						
					} else {
						
						keysToDelete = append(keysToDelete, key)
					}

				} else if p.Status == packet.Destroyed {
					
					err := s.voidTransaction(p)
					if err != nil {
						
						log.Printf("[Scheduler] Void error for packet %s: %v", key, err)
					} else {
						
						keysToDelete = append(keysToDelete, key)
					}
				}
			}
			
			if s.UpdateChan != nil {
				stateCopy := make(map[uuid.UUID]packet.Packet)
				for k, v := range s.ActivePackets {
						stateCopy[k] = *v
				}
				if len(stateCopy) > 0 {
					update := packet.StateUpdate{
							Packets:    stateCopy,
							ServerTime: time.Now().UnixNano() / int64(time.Millisecond),
					}
					select{
					case s.UpdateChan <- update:
					default:
					}
				}
			}

			for _, key := range keysToDelete{
					fmt.Printf("[Scheduler] Removing packet %s with status %s\n", key, s.ActivePackets[key].Status)
					delete(s.ActivePackets,key)
			}

			s.mu.Unlock()
			
		
		case <-stopChan:
			return
		}

	}
	
	
}


func (s *Scheduler) settleTransaction(p *packet.Packet) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	
	if p.SenderID == uuid.Nil || p.ReceiverID == uuid.Nil {
		log.Printf("[Settlement] Packet %s missing sender or receiver ID, skipping DB settlement", p.ID)
		
		err := s.ledger.Settle(p.ID)
		if err != nil {
			log.Printf("[Settlement] Ledger settle error: %v", err)
		}
		return nil
	}

	
	err := s.transactionRepo.SettleTransaction(
		ctx,
		p.ID,
		p.SenderID,
		p.ReceiverID,
		p.Payload.Amount,
		p.Payload.CurrencyID,
	)
	
	if err != nil {
		return fmt.Errorf("database settlement failed: %w", err)
	}

	
	ledgerErr := s.ledger.Settle(p.ID)
	if ledgerErr != nil {
		log.Printf("[Settlement] Ledger settle error (non-fatal): %v", ledgerErr)
	}

	return nil
}


func (s *Scheduler) voidTransaction(p *packet.Packet) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	
	if p.SenderID == uuid.Nil {
		log.Printf("[Void] Packet %s missing sender ID, skipping DB void", p.ID)
		
		err := s.ledger.Void(p.ID)
		if err != nil {
			log.Printf("[Void] Ledger void error: %v", err)
		}
		return nil
	}

	
	err := s.transactionRepo.VoidTransaction(
		ctx,
		p.ID,
		p.SenderID,
		p.Payload.Amount,
		p.Payload.CurrencyID,
	)
	
	if err != nil {
		return fmt.Errorf("database void failed: %w", err)
	}

	
	ledgerErr := s.ledger.Void(p.ID)
	if ledgerErr != nil {
		log.Printf("[Void] Ledger void error (non-fatal): %v", ledgerErr)
	}

	return nil
}

func (s *Scheduler) AddPacket(p *packet.Packet){
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ActivePackets[p.ID] = p
	fmt.Printf("[Scheduler] Added packet %s from %v to %v\n", p.ID, p.Start, p.End)
}


func (s *Scheduler) GetState() map[uuid.UUID]packet.Packet{
	s.mu.RLock()
	defer s.mu.RUnlock()
	stateCopy := make(map[uuid.UUID]packet.Packet)

	for k, v := range s.ActivePackets {
		stateCopy[k] = *v
	}

	return stateCopy
}

