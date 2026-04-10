
package engine

import(
	"backend/internal/models/packet"
	"math"
	"strings"
	"time"
)

// Scale: 1 AU = 100 world units.
const SpeedOfLight float64 = 50.0 // speed of light....but made unitary..299,792,458 m/s (scale-independent)

const Pull_r float64 = 40.0 
const Time_dil = 0.3 


const ArrivalThreshold = 40.0


type Planet struct {
	Name         string  `json:"name"`
	Distance     float64 `json:"distance"`
	Speed        float64 `json:"speed"`
	InitialAngle float64 `json:"initial_angle"`
}


var Planets = map[string]Planet{
	"mercury": {Name: "mercury", Distance: 39, Speed: 0.82, InitialAngle: 0},
	"venus":   {Name: "venus", Distance: 72, Speed: 0.32, InitialAngle: 0},
	"earth":   {Name: "earth", Distance: 100, Speed: 0.20, InitialAngle: 0},
	"mars":    {Name: "mars", Distance: 152, Speed: 0.11, InitialAngle: 0},
	"jupiter": {Name: "jupiter", Distance: 520, Speed: 0.017, InitialAngle: 0},
	"saturn":  {Name: "saturn", Distance: 954, Speed: 0.0067, InitialAngle: 0},
	"uranus":  {Name: "uranus", Distance: 1919, Speed: 0.0024, InitialAngle: 0},
	"neptune": {Name: "neptune", Distance: 3007, Speed: 0.0012, InitialAngle: 0},
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

func pointDistance(a, b packet.Point) float64 {
	return math.Sqrt(
		math.Pow(b.X-a.X, 2) +
		math.Pow(b.Y-a.Y, 2) +
		math.Pow(b.Z-a.Z, 2),
	)
}

func PredictPlanetPosition(name string, t time.Time, leadSeconds float64) (packet.Point, bool) {
	p, ok := GetPlanet(name)
	if !ok {
		return packet.Point{}, false
	}

	if leadSeconds <= 0 {
		return GetPlanetOrbitPosition(p, t), true
	}

	leadDuration := time.Duration(leadSeconds * float64(time.Second))
	return GetPlanetOrbitPosition(p, t.Add(leadDuration)), true
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
	dist := math.Sqrt(
		math.Pow(end.X-start.X, 2)+
		math.Pow(end.Y-start.Y, 2)+
		math.Pow(end.Z-start.Z, 2),
	)
	height := math.Min(0.5+dist*0.05, 1.2)
	return packet.Point{
		X: (start.X + end.X) / 2,
		Y: (start.Y + end.Y) / 2 + height,
		Z: (start.Z + end.Z) / 2,
	}
}

func UpdatePos(p *packet.Packet, target packet.Point, deltaTime float64) {
	dir, dist := Direction(*p, target)
	if dist == 0 {
		return
	}

	if dist <= ArrivalThreshold {
		p.CurrentPos = target
		return
	}

	move := p.Velocity * p.DilationFactor * deltaTime
	if move >= dist {
		p.CurrentPos = target
		return
	}

	p.CurrentPos.X += dir.X * move
	p.CurrentPos.Y += dir.Y * move
	p.CurrentPos.Z += dir.Z * move
}

func estimateLeadSeconds(p *packet.Packet, target packet.Point) float64 {
	speed := p.Velocity * p.DilationFactor
	if speed <= 0 {
		return 0
	}

	return p.Distance(p.CurrentPos, target) / speed
}

func interceptTarget(name string, now time.Time, currentPos packet.Point, speed float64) (packet.Point, bool) {
	if speed <= 0 {
		return packet.Point{}, false
	}

	currentTarget, ok := GetPlanetPosition(name, now)
	if !ok {
		return packet.Point{}, false
	}

	leadSeconds := pointDistance(currentPos, currentTarget) / speed
	if leadSeconds < 0 {
		leadSeconds = 0
	}

	predictedTarget := currentTarget
	for i := 0; i < 4; i++ {
		futureTarget, ok := PredictPlanetPosition(name, now, leadSeconds)
		if !ok {
			return packet.Point{}, false
		}

		predictedTarget = futureTarget
		nextLead := pointDistance(currentPos, predictedTarget) / speed
		if math.Abs(nextLead-leadSeconds) < 0.05 {
			break
		}
		leadSeconds = nextLead
	}

	return predictedTarget, true
}

// use for global websocket loop in engine/scheduler.go
func RunPhysics(p *packet.Packet, blackHole packet.Point, deltaTime float64) {
	if p.Status == packet.Destroyed || p.Status == packet.Settled {
		return
	}

	now := time.Now()
	liveTarget, ok := GetPlanetPosition(p.DestinationPlanet, now)
	if !ok {
		return
	}

	target := liveTarget
	if predictedTarget, ok := interceptTarget(p.DestinationPlanet, now, p.CurrentPos, p.Velocity*p.DilationFactor); ok {
		target = predictedTarget
	}

	UpdatePos(p, target, deltaTime)

	ApplyGravity(p, blackHole)
	CheckArrival(p, liveTarget)
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

	if dist <= ArrivalThreshold {
		p.Status = packet.Settled
	}
}
