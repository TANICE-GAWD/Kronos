// defining Laws of the Universe

// providing scale factor
package engine

import(
	"backend/internal/models/packet"
	"math"
	"strings"
	"time"
)

const SpeedOfLight float64 = 50.0 // speed of light....but made unitary..299,792,458 m/s

const Pull_r float64 = 40.0 
const Time_dil = 0.3 

const ArrivalThreshold = 1.0


type Planet struct {
	Name         string  `json:"name"`
	Distance     float64 `json:"distance"`
	Speed        float64 `json:"speed"`
	InitialAngle float64 `json:"initial_angle"`
}

var Planets = map[string]Planet{
	"mercury": {Name: "mercury", Distance: 3, Speed: 2.0, InitialAngle: 0},
	"venus":   {Name: "venus", Distance: 4.5, Speed: 1.6, InitialAngle: 0},
	"earth":   {Name: "earth", Distance: 6, Speed: 1.0, InitialAngle: 0},
	"mars":    {Name: "mars", Distance: 8, Speed: 0.8, InitialAngle: 0},
	"jupiter": {Name: "jupiter", Distance: 12, Speed: 0.4, InitialAngle: 0},
	"uranus":  {Name: "uranus", Distance: 20, Speed: 0.2, InitialAngle: 0},
	"neptune": {Name: "neptune", Distance: 24, Speed: 0.15, InitialAngle: 0},
}

func GetPlanet(name string) (Planet, bool) {
	p, ok := Planets[strings.ToLower(name)]
	return p, ok
}

func GetPlanetOrbitPosition(p Planet, t time.Time) packet.Point {
	seconds := float64(t.UnixNano()) / 1e9
	angle := math.Mod(seconds*p.Speed + p.InitialAngle, 2*math.Pi)
	return packet.Point{
		X: p.Distance * math.Cos(angle),
		Y: 0,
		Z: p.Distance * math.Sin(angle),
	}
}

func GetPlanetPosition(name string, t time.Time) (packet.Point, bool) {
	p, ok := GetPlanet(name)
	if !ok {
		return packet.Point{}, false
	}
	return GetPlanetOrbitPosition(p, t), true
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

// New pos = cur pos + curve path interpolation using a quadratic bezier
func bezierPoint(p0, p1, p2 packet.Point, t float64) packet.Point {
	u := 1 - t
	return packet.Point{
		X: u*u*p0.X + 2*u*t*p1.X + t*t*p2.X,
		Y: u*u*p0.Y + 2*u*t*p1.Y + t*t*p2.Y,
		Z: u*u*p0.Z + 2*u*t*p1.Z + t*t*p2.Z,
	}
}

func curveControlPoint(start, end packet.Point) packet.Point {
	return packet.Point{
		X: (start.X + end.X) / 2,
		Y: (start.Y + end.Y) / 2 + 6,
		Z: (start.Z + end.Z) / 2,
	}
}

func UpdatePos(p *packet.Packet, target packet.Point, deltaTime float64) {
	_, dist := Direction(*p, target)
	if dist == 0 {
		return
	}

	move := p.Velocity * p.DilationFactor * deltaTime
	control := curveControlPoint(p.Start, target)
	curveHeight := math.Abs(control.Y - p.Start.Y)
	curveLength := dist + (curveHeight * 0.6)
	if curveLength <= 0 {
		curveLength = dist
	}

	deltaT := move / curveLength
	p.TravelT += deltaT

	if p.TravelT >= 1 {
		p.TravelT = 1
		p.CurrentPos = target
		return
	}

	p.CurrentPos = bezierPoint(p.Start, control, target, p.TravelT)
}

// use for global websocket loop in engine/scheduler.go
func RunPhysics(p *packet.Packet, blackHole packet.Point, deltaTime float64) {
	if p.Status == packet.Destroyed || p.Status == packet.Settled {
		return
	}

	target := p.End
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
