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



func (h *Hub) Run(){
	for{
		select{
		case client := <- h.register:
			h.clients[client] = true;
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
		case stateSnapshot := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- stateSnapshot:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}

}



