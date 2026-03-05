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




// func ETA (c *gin.Context){
// 	dist := packet.Distance()
// 	Time := dist/c
// 	return Time
// }



func Direction(p packet.Packet) packet.Point {
	// Direction =  (end - start)/distance
	dist := p.Distance()

	if dist == 0{
		return packet.Point{}
	}

	return packet.Point{
		X: (p.End.X - p.Start.X)/dist,
		Y: (p.End.Y - p.Start.Y)/dist,
		Z: (p.End.Z - p.Start.Z)/dist,
	}

}


// New pos = cur pos + (Direction * Velocity * DeltaTime *  Dil factor) // Delta time = each tick /frame of server

func UpdatePos(p *packet.Packet, deltaTime float64) {
	dir := Direction(*p)


	move := p.Velocity * p.DilationFactor * deltaTime
	p.CurrentPos.X += dir.X * move
	p.CurrentPos.Y += dir.Y * move
	p.CurrentPos.Z += dir.Z * move
	
}



func RunPhysics(p *packet.Packet){
	ticker := time.NewTicker(time.Second/60)
	last := time.Now()
	defer ticker.Stop()
	for range ticker.C {
		now  := time.Now()
		delta := now.Sub(last).Seconds()
		last = now

		UpdatePos(p , delta)
	}
	

}
