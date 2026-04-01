package transport

import (
	"time"
	"net/http"
	"github.com/google/uuid"
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

type Client struct{
	ID string
	Conn *websocket.Conn
	send chan map[uuid.UUID]packet.Packet
	hub *Hub
}


func NewClient(id string, conn *websocket.Conn, hub *Hub) *Client {
	return &Client{ID: id, Conn: conn, send: make(chan map[uuid.UUID]packet.Packet), hub: hub}
}



func (c *Client) Close(){
	close(c.send)
}


