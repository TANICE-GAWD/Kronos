package engine


import(
	"time",
	"models/packet"
	"sync"
	"github.com/google/uuid"
	"physics"
)

type Scheduler struct{
	ActivePackets map[uuid.UUID]*packet.Packet
	mu sync.RWMutex
	BlackHole packet.Point
	UpdateChan chan map[uuid.UUID]*packet.Packet
}


func NewScheduler(blackHole packet.Point) *Scheduler {
	return &Scheduler{
		ActivePackets: make(map[uuid.UUID]*packet.Packet), 
		BlackHole:     blackHole,
		UpdateChan:    make(chan map[uuid.UUID]*packet.Packet), 
	}
}

func (s *Scheduler) Start(){
	tick := time.NewTicker(time.Second/60)
	last := time.Now()

	defer tick.Stop()
	
	for range tick.C{
		keysToDelete := []uuid.UUID{}
		
		now:= time.Now()
		deltaTime := now.Sub(last).Seconds()
		last = now
		s.mu.Lock()
		for key, p := range s.ActivePackets{
			physics.RunPhysics(p, s.BlackHole, deltaTime)
			if(p.Status == packet.Settled || p.Status == packet.Destroyed){
				keys = append(keysToDelete,key)
			}
		}
		
		for _, key := range keys{
			delete(s.ActivePackets,key)
		}

		


		keysToDelete = nil
		s.mu.Unlock()
	}
	
	
}

func (s *Scheduler) AddPacket(p *packet.Packet){
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ActivePackets[p.ID] = p
	

}

