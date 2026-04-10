package engine


import(
	"time"
	"backend/internal/models/packet"
	"sync"
	"github.com/google/uuid"
	"fmt"
)

type Scheduler struct{
	ActivePackets map[uuid.UUID]*packet.Packet
	mu sync.RWMutex
	BlackHole packet.Point
	UpdateChan chan packet.StateUpdate // not using pointers coz it was causing jittery movement
}


func NewScheduler(blackHole packet.Point) *Scheduler {
	return &Scheduler{
		ActivePackets: make(map[uuid.UUID]*packet.Packet), 
		BlackHole:     blackHole,
		UpdateChan:    make(chan packet.StateUpdate, 16), 
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
			for key, p := range s.ActivePackets{
				RunPhysics(p, s.BlackHole, deltaTime)
				if(p.Status == packet.Settled || p.Status == packet.Destroyed){
					keysToDelete = append(keysToDelete,key)
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

func (s *Scheduler) AddPacket(p *packet.Packet){
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ActivePackets[p.ID] = p
	fmt.Printf("[Scheduler] Added packet %s from %v to %v\n", p.ID, p.Start, p.End)
}

// on demand call
func (s *Scheduler) GetState() map[uuid.UUID]packet.Packet{
	s.mu.RLock()
	defer s.mu.RUnlock()
	stateCopy := make(map[uuid.UUID]packet.Packet)

	for k, v := range s.ActivePackets {
		stateCopy[k] = *v
	}

	return stateCopy
}

