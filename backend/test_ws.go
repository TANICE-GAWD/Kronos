package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"os/signal"
	"time"

	"github.com/gorilla/websocket"
)

func main() {
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	u := url.URL{Scheme: "ws", Host: "localhost:8080", Path: "/ws"}
	log.Printf("Connecting to %s", u.String())

	ws, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatal("dial:", err)
	}
	defer ws.Close()

	done := make(chan struct{})

	go func() {
		defer close(done)
		for {
			message := make(map[string]interface{})
			err := ws.ReadJSON(&message)
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("error: %v", err)
				}
				return
			}

			fmt.Println("\n=== Received WebSocket Message ===")
			msgJSON, _ := json.MarshalIndent(message, "", "  ")
			fmt.Println(string(msgJSON))

			// Check for expected fields
			fmt.Println("\n=== Field Analysis ===")
			fmt.Printf("Has 'timestamp': %v\n", hasKey(message, "timestamp"))
			fmt.Printf("Has 'packets': %v\n", hasKey(message, "packets"))
			fmt.Printf("Has 'wallets': %v\n", hasKey(message, "wallets"))
			fmt.Printf("Has 'transactions': %v\n", hasKey(message, "transactions"))
			fmt.Printf("Has 'users': %v\n", hasKey(message, "users"))

			if packets, ok := message["packets"]; ok {
				fmt.Printf("Packets type: %T\n", packets)
				fmt.Printf("Packets value: %v\n", packets)
			}
			if wallets, ok := message["wallets"]; ok {
				fmt.Printf("Wallets type: %T\n", wallets)
			}
			if transactions, ok := message["transactions"]; ok {
				fmt.Printf("Transactions type: %T\n", transactions)
			}
			if users, ok := message["users"]; ok {
				fmt.Printf("Users type: %T\n", users)
			}
		}
	}()

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			return
		case t := <-ticker.C:
			err := ws.WriteMessage(websocket.TextMessage, []byte(t.String()))
			if err != nil {
				log.Println("write:", err)
				return
			}
		case <-interrupt:
			log.Println("interrupt")

			err := ws.WriteMessage(websocket.CloseMessage, []byte{})
			if err != nil {
				log.Println("write close:", err)
				return
			}
			select {
			case <-done:
			case <-time.After(time.Second):
			}
			return
		}
	}
}

func hasKey(m map[string]interface{}, key string) bool {
	_, ok := m[key]
	return ok
}
