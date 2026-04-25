/**
 * useWebSocket Hook
 *
 * Custom React hook for subscribing to WebSocket state updates.
 * Handles connection lifecycle and cleanup automatically.
 *
 * Usage:
 *   const { state, changes, isConnected } = useWebSocket();
 *   useEffect(() => {
 *     if (state.packets) {
 *       // Update 3D scene with state.packets
 *     }
 *   }, [state.packets]);
 */

import { useEffect, useState, useCallback } from 'react';
import WebSocketManager from './WebSocketManager';

export function useWebSocket(autoConnect = true, wsUrl = 'ws://localhost:8080/ws') {
  const [state, setState] = useState(null);
  const [changes, setChanges] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const manager = WebSocketManager.getInstance();

    // Connect if requested
    if (autoConnect && !manager.isConnectedToServer()) {
      try {
        manager.connect(wsUrl);
      } catch (err) {
        setError(err);
      }
    }

    // Get initial state
    setState(manager.getState());
    setIsConnected(manager.isConnectedToServer());

    // Subscribe to updates
    const unsubscribe = manager.subscribe((newState, newChanges) => {
      setState(newState);
      setChanges(newChanges);
      setIsConnected(manager.isConnectedToServer());
      setError(null);
    });

    return () => {
      // Cleanup subscription when component unmounts
      unsubscribe();
    };
  }, [autoConnect, wsUrl]);

  const disconnect = useCallback(() => {
    WebSocketManager.getInstance().disconnect();
  }, []);

  const reconnect = useCallback(() => {
    WebSocketManager.getInstance().reconnect();
  }, []);

  return {
    state,
    changes,
    isConnected,
    error,
    disconnect,
    reconnect
  };
}

export default useWebSocket;
