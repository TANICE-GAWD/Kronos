package main
import(
	"net/http"
	"github.com/gin-gonic/gin"
	"backend/internal/engine"
	"backend/internal/transport"
	"github.com/google/uuid"
	"backend/internal/models/packet"
	"time"
)

var BlackHole = packet.Point{X: 10, Y: 10, Z:10}

const(
	SpeedOfLight float64 = 50.0
)


// flow:
// Scheduler >> Hub >> client.send >> Write >> Websocket


type TransferRequest struct{
	OriginPlanet      string  `json:"origin_planet" binding:"required"`
    DestinationPlanet string  `json:"destination_planet" binding:"required"`
    Amount            float64 `json:"amount" binding:"required,gt=0"`
	CurrencyID		  string   `json:"currency_id" binding:"required"`
}

func main(){
	r := gin.Default()
	hub := transport.NewHub()
	scheduler := engine.NewScheduler(BlackHole)
	go hub.Run();
	stop := make(chan struct{})
	go scheduler.Start(stop)

	go func(){
		for stateSnapshot := range scheduler.UpdateChan {
			hub.Broadcast(stateSnapshot)
		}
	}()

	r.POST("/transfer", func(ctx *gin.Context) {
		TransferHandler(ctx, scheduler)
	})
	r.GET("/ws", func(ctx *gin.Context) {
		transport.ServeWS(ctx, uuid.New().String(), hub)
	})

	r.Run(":8080")

}

func TransferHandler(ctx *gin.Context, scheduler *engine.Scheduler){
	var req TransferRequest
	if err := ctx.ShouldBindJSON(&req); err != nil{
		ctx.JSON(http.StatusBadRequest, gin.H{"error" : err.Error()})
		return
	}

	originPos := engine.GetPlanetPosition(req.OriginPlanet)
	destPos := engine.GetPlanetPosition(req.DestinationPlanet)
	id := uuid.New()

	p := &packet.Packet{
		ID : id,
		Start : originPos,
		End : destPos,
		DestinationPlanet : req.DestinationPlanet,
		CurrentPos : originPos,
		Payload: packet.Payload{
					Amount: req.Amount,
					CurrencyID: req.CurrencyID,
					},
		LaunchTime : time.Now(),
		Status : packet.Active,
		DilationFactor : 1,
		Velocity : SpeedOfLight,
	}

	scheduler.AddPacket(p)
	ctx.JSON(http.StatusOK, gin.H{"id" : id, "status" : "active"})


}