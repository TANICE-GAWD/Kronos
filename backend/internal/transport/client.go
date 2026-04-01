package transport

import (
	"time"
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
	return &Client{ID: id, Conn: conn, send: make(chan map[uuid.UUID]packet.Packet, 1), hub: hub}
}



func (c *Client) Close(){
	close(c.send)
}


func (c *Client) Write(){
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
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
			else{
				err:= c.Conn.WriteJSON(stateSnapshot)
				if err != nil{
					return
				}
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		
		}
	}



}





