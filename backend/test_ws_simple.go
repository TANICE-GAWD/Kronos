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
	messageCount := 0

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

			messageCount++
			fmt.Printf("\n=== Message #%d ===\n", messageCount)
			msgJSON, _ := json.MarshalIndent(message, "", "  ")
			fmt.Println(string(msgJSON))

			// Show field analysis
			fmt.Println("\n=== Fields Present ===")
			for key := range message {
				val := message[key]
				if m, ok := val.(map[string]interface{}); ok {
					fmt.Printf("%s: {map with %d keys}\n", key, len(m))
				} else if arr, ok := val.([]interface{}); ok {
					fmt.Printf("%s: [array with %d items]\n", key, len(arr))
				} else {
					fmt.Printf("%s: %v (%T)\n", key, val, val)
				}
			}

			// Stop after first message to keep output manageable
			if messageCount >= 1 {
				fmt.Println("\n(Stopping after first message)")
				ws.Close()
				return
			}
		}
	}()

	// Wait a bit for connection
	time.Sleep(500 * time.Millisecond)

	select {
	case <-done:
		return
	case <-time.After(5 * time.Second):
		fmt.Println("Timeout waiting for WebSocket message")
		ws.Close()
	case <-interrupt:
		fmt.Println("Interrupt received")
		ws.WriteMessage(websocket.CloseMessage, []byte{})
		time.Sleep(time.Second)
	}
}
