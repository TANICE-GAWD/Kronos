package transport

import(
	"time"
	"net/http"
	"math/rand"
	"backend/internal/models/packet"

)

type Hub struct{
	register chan *Client
	unregister chan *Client
	clients map[*Client]bool
	broadcast chan map[uuid.UUID]packet.Packet
}

func NewHub () *Hub{
	return &Hub{
		clients: make(map[*Client]bool),
		register: make(chan *Client),
		unregister: make(chan *Client),
		broadcast: make(chan map[uuid.UUID]packet.Packet),
	}
}

func (h *Hub) RegisterClient(c *Client){
	h.clients[c] = true;
}

func (h *Hub) UnRegisterClient (c *Client){
	_,ok := h.clients[c]
	if ok{
		delete(h.clients,c)
		close(c.send)
	}

}

func (h *Hub) Run(){
	for{
		select{
		case client := <- h.register:
			h.RegisterClient(client)
		case client := <-h.unregister:
			h.UnRegisterClient(client)
		case stateSnapshot := <-h.broadcast:
			h.BroadCast(stateSnapshot)
		}
	}

}


func (h *Hub) BroadCast(ss map[uuid.UUID]packet.Packet){
	for client := range h.clients{
		select{
		case client.send <- ss:
		default:
			close(client.send)
			delete(h.clients,client)
		}
	}

}
