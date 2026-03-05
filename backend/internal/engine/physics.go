// defining Laws of the Universe

// providing scale factor
package physics

import(
	"models/packet"
	"time"
)

const c float64 = 50.0 // speed of light....but made unitary..299,792,458 m/s

const pull_r float64 = 40.0 // define pull rad for Blackhoel
const time_dil = 0.3 




// func ETA (c *gin.Context){
// 	dist := packet.Distance()
// 	Time := dist/c
// 	return Time
// }

unit vector =  vector/vector_magnitude

func Direction(p packet.Packet) packet.Point {
	// Direction =  (end - start)/distance
	dist := p.Distance
	
	return packet.Point{
		X: (p.End.X - p.Start.X)/dist,
		Y: (p.End.Y - p.Start.X)/dist,
		Z: (p.End.Z - p.Start.X)/dist,
	}

}


// New pos = cur pos + (Direction * Velocity * DeltaTime *  Dil factor) // Delta time = each tick /frame of server

func UpdatePos(p packet.Packet, deltaTime float64) {
	dir := Direction(*p)
	ticker := time.Tick(1 * time.Second)
	for i:=0 ; i< (what do i put here); i++{
		<-ticker
		DeltaTime := time.Now
		New_pos := p.CurrentPos + (Direction * p.Velocity * DeltaTime * p.DilationFactor)

	}

	
	
}