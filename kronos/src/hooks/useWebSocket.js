

import { useEffect, useState, useCallback } from 'react';
import WebSocketManager from './WebSocketManager';
import { WS_URL } from '../config';

export function useWebSocket(autoConnect = true, wsUrl = WS_URL) {
  const [state, setState] = useState(null);
  const [changes, setChanges] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const manager = WebSocketManager.getInstance();

    
    if (autoConnect && !manager.isConnectedToServer()) {
      try {
        manager.connect(wsUrl);
      } catch (err) {
        setError(err);
      }
    }

    
    setState(manager.getState());
    setIsConnected(manager.isConnectedToServer());

    
    const unsubscribe = manager.subscribe((newState, newChanges) => {
      setState(newState);
      setChanges(newChanges);
      setIsConnected(manager.isConnectedToServer());
      setError(null);
    });

    return () => {
      
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
