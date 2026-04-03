package transport

import (
	"log"
	"time"
	"fmt"
	"net/http"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/google/uuid"
	"backend/internal/models/packet"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize : 1024,
	WriteBufferSize : 1024,
	CheckOrigin: func(r *http.Request) bool { return true },
	
}

const (
	writeWait = 10 * time.Second
	pongWait  = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)



type Client struct{
	ID string
	Conn *websocket.Conn
	send chan map[uuid.UUID]packet.Packet
	hub *Hub
}


func NewClient(id string, conn *websocket.Conn, hub *Hub) *Client {
	return &Client{ID: id, Conn: conn, send: make(chan map[uuid.UUID]packet.Packet, 256), hub: hub}
}




// Scheduler >> Hub >> client.send >> Write >> Websocket
// stateCopy >> stateSnapshot >> client.send >> message


func (c *Client) Write(){
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.hub.unregister <- c
		c.Conn.Close()
	}()

	for{
		select{
		case stateSnapshot, ok := <- c.send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok{
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			
			err:= c.Conn.WriteJSON(stateSnapshot)
			if err != nil{
				log.Println("Error", err)
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Println("Ping error:", err)
				return
			}
		
		}
	}



}


func (c *Client) Read(){
	defer func(){
		c.hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512)

	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			log.Println("ping error:", err)
			break
		}

		log.Println("Received:", string(message))
	}



}



func (c *Client) Close(){
	close(c.send)
}

func ServeWS(ctx *gin.Context, roomID string, hub *Hub, initialState map[uuid.UUID]packet.Packet){
	ws, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil{
		fmt.Println(err.Error())
		return
	}

	client := NewClient(roomID, ws ,hub)

	hub.register <- client

	if initialState != nil && len(initialState) > 0 {
		err := client.Conn.WriteJSON(initialState)
		if err != nil {
			log.Println("Error sending initial state:", err)
		}
	}

	go client.Write()
	go client.Read()
}