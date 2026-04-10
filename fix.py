import os

# fix client.go
with open('backend/internal/transport/client.go', 'r') as f:
    content = f.read()

content = content.replace('if initialState != nil && len(initialState) > 0 {\n\t\terr := client.Conn.WriteJSON(initialState)\n\t\tif err != nil {\n\t\t\tlog.Println("Error sending initial state:", err)\n\t\t}\n\t}', 'if initialState != nil && len(initialState) > 0 {\n\t\tupdate := packet.StateUpdate{\n\t\t\tPackets:    initialState,\n\t\t\tServerTime: time.Now().UnixNano() / int64(time.Millisecond),\n\t\t}\n\t\terr := client.Conn.WriteJSON(update)\n\t\tif err != nil {\n\t\t\tlog.Println("Error sending initial state:", err)\n\t\t}\n\t}')
content = content.replace('chan map[uuid.UUID]packet.Packet', 'chan packet.StateUpdate')

with open('backend/internal/transport/client.go', 'w') as f:
    f.write(content)

# fix scheduler.go
with open('backend/internal/engine/scheduler.go', 'r') as f:
    content = f.read()

content = content.replace('UpdateChan chan map[uuid.UUID]packet.Packet', 'UpdateChan chan packet.StateUpdate')
content = content.replace('UpdateChan:    make(chan map[uuid.UUID]packet.Packet, 16)', 'UpdateChan:    make(chan packet.StateUpdate, 16)')

target = '''\t\t\t\tif len(stateCopy) > 0 {
\t\t\t\t\t// fmt.Printf("[Scheduler] Broadcasting %d packets\\n", len(stateCopy))
\t\t\t\t\tselect{
\t\t\t\t\tcase s.UpdateChan <- stateCopy:
\t\t\t\t\tdefault:
\t\t\t\t\t}
\t\t\t\t}'''

replacement = '''\t\t\t\tif len(stateCopy) > 0 {
\t\t\t\t\tupdate := packet.StateUpdate{
\t\t\t\t\t\tPackets:    stateCopy,
\t\t\t\t\t\tServerTime: time.Now().UnixNano() / int64(time.Millisecond),
\t\t\t\t\t}
\t\t\t\t\t// fmt.Printf("[Scheduler] Broadcasting %d packets\\n", len(stateCopy))
\t\t\t\t\tselect{
\t\t\t\t\tcase s.UpdateChan <- update:
\t\t\t\t\tdefault:
\t\t\t\t\t}
\t\t\t\t}'''

content = content.replace(target, replacement)

with open('backend/internal/engine/scheduler.go', 'w') as f:
    f.write(content)

