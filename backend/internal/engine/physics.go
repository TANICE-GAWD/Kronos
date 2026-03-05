// defining Laws of the Universe

// providing scale factor
package physics

import(
	"models/packet"
	"time"
)

const SpeedOfLight float64 = 50.0 // speed of light....but made unitary..299,792,458 m/s

const Pull_r float64 = 40.0 // define pull rad for Blackhoel
const Time_dil = 0.3 

const ArrivalThreshold = 3.0

 // below is temporary mock fix...late remember to put a struct of planet and then map it here
func GetPlaentPosition(name string ) packet.Point{
	switch name{

	case "earth":
		return packet.Point{X: 0, Y: 0, Z: 0}

	case "mars":
		return packet.Point{X: 200, Y: 0, Z: 0}

	default:
		return packet.Point{}
	}
}


func Direction(p packet.Packet, target packet.Point) packet.Point {

	dist := packet.Distance(p.CurrentPos, target)

	if dist == 0 {
		return packet.Point{}
	}

	return packet.Point{
		X: (target.X - p.CurrentPos.X) / dist,
		Y: (target.Y - p.CurrentPos.Y) / dist,
		Z: (target.Z - p.CurrentPos.Z) / dist,
	}
}


// New pos = cur pos + (Direction * Velocity * DeltaTime *  Dil factor) // Delta time = each tick /frame of server

func UpdatePos(p *packet.Packet, target packet.Point, deltaTime float64) {

	dir := Direction(*p, target)

	move := p.Velocity * p.DilationFactor * deltaTime

	p.CurrentPos.X += dir.X * move
	p.CurrentPos.Y += dir.Y * move
	p.CurrentPos.Z += dir.Z * move
}




func RunPhysics(p *packet.Packet, blackHole packet.Point) {

	ticker := time.NewTicker(time.Second / 60)
	last := time.Now()
	defer ticker.Stop()

	for range ticker.C {

		now := time.Now()
		delta := now.Sub(last).Seconds()
		last = now

		
		target := GetPlanetPosition(p.DestinationPlanet)

		UpdatePos(p, target, delta)

		ApplyGravity(p, blackHole)

		CheckArrival(p, target)

		if p.Status == packet.Destroyed || p.Status == packet.Settled {
			return
		}
	}
}


func ApplyGravity(p *packet.Packet, blackHolePos packet.Point) {

	dist := packet.Distance(p.CurrentPos, blackHolePos)

	if dist <= Pull_r {
		p.Status = packet.Destroyed
		return
	}

	if dist < Pull_r+10 {

		p.Status = packet.Stalled

		if p.DilationFactor > 0.1 {
			p.DilationFactor -= 0.01
		}

	} else {

		p.Status = packet.Active
		p.DilationFactor = 1.0
	}
}


func CheckArrival(p *packet.Packet, target packet.Point) {

	dist := packet.Distance(p.CurrentPos, target)

	if dist < ArrivalThreshold {
		p.Status = packet.Settled
	}
}
