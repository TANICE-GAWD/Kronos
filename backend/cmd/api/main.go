package main
import(
	"net/http"
	"github.com/gin-gonic/gin"
	"backend/internal/engine"
	"backend/internal/transport"
	"github.com/google/uuid"
	"backend/internal/models/package"
	"time"
)

const(
	BlackHole Packet.Point = (10,10,10)
	SpeedOfLight float64 = 50.0
)


// flow:
// Scheduler >> Hub >> client.send >> Write >> Websocket


type TransferRequest struct{
	OriginPlanet      string  `json:"origin_planet" binding:"required"`
    DestinationPlanet string  `json:"destination_planet" binding:"required"`
    Amount            float64 `json:"amount" binding:"required,gt=0"`
}

func main(){
	r := gin.Default()
	
	r.Run(":8080")
	hub := transport.NewHub()
	scheduler := engine.NewScheduler(BlackHole)
	go hub.Run();
	scheduler.Start()

	go func(){
		for{
			select{
			case stateSnapshot := <-scheduler.UpdateChan:
				hub.broadcast <- stateSnapshot
			}
		default:
			return
		}
	}()

	r.POST("/transfer", TransferHandler(scheduler))

}

func TransferHandler(ctx *gin.Context, scheduler *engine.Scheduler){
	var req TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil{
		c.JSON(http.StatusBadRequest, gin.H(err.Error()))
		return
	}

	originPos := physics.GetPlanetPosition(req.OriginPlanet)
	destPos := physics.GetPlanetPosition(req.DestinationPlanet)
	id := uuid.New()

	packet := packet.Packet{
		ID : id,
		Start : originPos
		End : destPos
		DestinationPlanet : req.DestinationPlanet
		CurrentPos : originPos,
		Payload : req.Amount,
		LaunchTime : time.Now(),
		Status : package.Active,
		DilationFactor : 1,
		Velocity : SpeedOfLight,
	}

	scheduler.AddPacket(packet)
	c.JSON(http.StatusOk, gin.H{"id" : id, "status" : "Active"})


}