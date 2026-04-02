// defining Laws of the Universe

// providing scale factor
package engine

import(
	"backend/internal/models/packet"
)

const SpeedOfLight float64 = 50.0 // speed of light....but made unitary..299,792,458 m/s

const Pull_r float64 = 40.0 
const Time_dil = 0.3 

const ArrivalThreshold = 1.0


 // below is temporary mock fix...later remember to put a struct of planet and then map it here
func GetPlanetPosition(name string ) packet.Point{
	switch name{

	case "earth":
		return packet.Point{X: 0, Y: 0, Z: 0}

	case "mars":
		return packet.Point{X: 200, Y: 0, Z: 0}

	default:
		return packet.Point{}
	}
}


func Direction(p packet.Packet, target packet.Point) (packet.Point, float64) {

	dist := p.Distance(p.CurrentPos, target)

	if dist == 0 {
		return packet.Point{}, 0
	}

	return packet.Point{
		X: (target.X - p.CurrentPos.X) / dist,
		Y: (target.Y - p.CurrentPos.Y) / dist,
		Z: (target.Z - p.CurrentPos.Z) / dist,
	}, dist
}


// New pos = cur pos + (Direction * Velocity * DeltaTime *  Dil factor) // Delta time = each tick /frame of server

func UpdatePos(p *packet.Packet, target packet.Point, deltaTime float64) {

	dir, dist := Direction(*p, target)

	move := p.Velocity * p.DilationFactor * deltaTime
	if move >= dist {
		p.CurrentPos = target
		return
	}

	p.CurrentPos.X += dir.X * move
	p.CurrentPos.Y += dir.Y * move
	p.CurrentPos.Z += dir.Z * move
}



// use for global websocket loop in engine/scheduler.go
func RunPhysics(p *packet.Packet, blackHole packet.Point, deltaTime float64) {
	if p.Status == packet.Destroyed || p.Status == packet.Settled {
		return
	}

	
	target := GetPlanetPosition(p.DestinationPlanet)

	
	UpdatePos(p, target, deltaTime)


	ApplyGravity(p, blackHole)
	CheckArrival(p, target)
}


func ApplyGravity(p *packet.Packet, blackHolePos packet.Point) {

	dist := p.Distance(p.CurrentPos, blackHolePos)

	if dist <= Pull_r {
		p.Status = packet.Destroyed
		return
	}

	if dist < Pull_r+20 {

		p.Status = packet.Stalled

		if p.DilationFactor > Time_dil {
			p.DilationFactor -= 0.05
		}

	} else {

		p.Status = packet.Active
		p.DilationFactor = 1.0
	}
}


func CheckArrival(p *packet.Packet, target packet.Point) {

	dist := p.Distance(p.CurrentPos, target)

	if dist < ArrivalThreshold {
		p.Status = packet.Settled
	}
}
