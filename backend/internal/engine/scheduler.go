package engine


import(
	"time",
	"models/packet"
	"sync"
	"uuid"
)
type Scheduler struct{
	ActivePackets map[uuid.UUID]*packet.Packet
	mu sync.RWMutex
	BlackHole packet.Point
	UpdateChan chan map[uuid.UUID]*packet.Packet

func Start(s *Scheduler){
	tick := time.NewTicker(time.Second/60)
	last := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	
	for range tick.C{

		for key,p range s.ActivePackets{
			now:= time.Now()
			deltaTime := now.Sub(last)
			last = now
			physics.RunPhysics(p, BlackHole, deltaTime)
			if(p.Status == p.Settled || p.Status == p.Destroyed){
				p.CleanUp()
			}
		}
		
	}
}

func (s *Scheduler) AddPacket(p *packet.Packet){
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ActivePackets[p.ID] = p
	

}

func (s *Scheduler) CleanUp(){
		delete(ActivePackets[UUID],p)
}