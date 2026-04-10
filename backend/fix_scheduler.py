with open('/home/tanice/Desktop/Kronos/backend/internal/engine/scheduler.go', 'r') as f:
    text = f.read()

old_str = """                        for _, key := range keysToDelete{
                                fmt.Printf("[Scheduler] Removing packet %s with status %s\\n", key, s.ActivePackets[key].Status)
                                delete(s.ActivePackets,key)
                        }

                        s.mu.Unlock()

                        if s.UpdateChan != nil {
                                stateCopy := s.GetState()
                                if len(stateCopy) > 0 {"""

new_str = """                        var stateCopy map[uuid.UUID]packet.Packet
                        if s.UpdateChan != nil {
                                stateCopy = make(map[uuid.UUID]packet.Packet)
                                for k, v := range s.ActivePackets {
                                        stateCopy[k] = *v
                                }
                        }

                        for _, key := range keysToDelete{
                                fmt.Printf("[Scheduler] Removing packet %s with status %s\\n", key, s.ActivePackets[key].Status)
                                delete(s.ActivePackets,key)
                        }

                        s.mu.Unlock()

                        if s.UpdateChan != nil && len(stateCopy) > 0 {"""

text = text.replace(old_str, new_str)
with open('/home/tanice/Desktop/Kronos/backend/internal/engine/scheduler.go', 'w') as f:
    f.write(text)
