/**
 * INTEGRATION GUIDE: WebSocketManager
 *
 * This document shows how to integrate WebSocketManager with your existing components.
 */

// ============================================================================
// EXAMPLE 1: 3D Scene Controller (Three.js Integration)
// ============================================================================

import { useEffect, useRef } from 'react';
import useWebSocket from '../hooks/useWebSocket';

export function Scene3D() {
  const { state, changes, isConnected } = useWebSocket();
  const sceneRef = useRef(null);
  const meshesRef = useRef(new Map()); // Map of packet ID to Three.js mesh

  useEffect(() => {
    if (!state?.packets || !changes) return;

    const { added, updated, removed } = changes.packetChanges || {};

    // Handle newly added packets
    if (added && added.length > 0) {
      added.forEach(packet => {
        const mesh = createPacketMesh(packet);
        meshesRef.current.set(packet.id, mesh);
        sceneRef.current?.add(mesh);
        console.log(`[3D Scene] Added packet ${packet.id} from ${packet.originPlanet} to ${packet.destinationPlanet}`);
      });
    }

    // Handle updated packets (moved, status changed)
    if (updated && updated.length > 0) {
      updated.forEach(({ id, new: newPacket, changes: packetChanges }) => {
        const mesh = meshesRef.current.get(id);
        if (!mesh) return;

        // Update position if it changed
        if (packetChanges.positionChanged) {
          const [x, y, z] = newPacket.currentPos;
          mesh.position.set(x, y, z);
        }

        // Update status if it changed (e.g., settled, destroyed)
        if (packetChanges.statusChanged) {
          console.log(`[3D Scene] Packet ${id} status: ${newPacket.status}`);
          if (newPacket.status === 'settled' || newPacket.status === 'destroyed') {
            // Fade out or remove animation
            mesh.userData.shouldRemove = true;
          }
        }
      });
    }

    // Handle removed packets
    if (removed && removed.length > 0) {
      removed.forEach(packet => {
        const mesh = meshesRef.current.get(packet.id);
        if (mesh && sceneRef.current) {
          sceneRef.current.remove(mesh);
          meshesRef.current.delete(packet.id);
          console.log(`[3D Scene] Removed packet ${packet.id}`);
        }
      });
    }
  }, [state?.packets, changes]);

  return (
    <div>
      <div ref={sceneRef} style={{ width: '100%', height: '600px' }} />
      <div style={{ fontSize: '12px', color: '#666' }}>
        Connection: {isConnected ? '✓ Connected' : '✗ Disconnected'}
        | Packets: {state?.packets?.length || 0}
      </div>
    </div>
  );
}

function createPacketMesh(packet) {
  // This is pseudo-code; integrate with actual Three.js
  // const geometry = new THREE.SphereGeometry(1, 8, 8);
  // const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  // const mesh = new THREE.Mesh(geometry, material);
  // mesh.position.set(...packet.currentPos);
  // mesh.userData.packetId = packet.id;
  // return mesh;

  const mesh = { position: {} }; // Simplified
  return mesh;
}

// ============================================================================
// EXAMPLE 2: Balance Display / Wallet UI
// ============================================================================

export function WalletUI({ userId }) {
  const { state, changes, isConnected } = useWebSocket();

  // Get current wallet for this user
  const wallet = state?.wallets?.[userId];

  // Detect balance changes for animations
  useEffect(() => {
    if (!changes?.walletChanges) return;

    const walletChange = changes.walletChanges.find(w => w.userId === userId);
    if (walletChange && walletChange.type === 'updated') {
      // Flash animation when balance changes
      console.log(`[Wallet] Balance changed for ${userId}:`, walletChange.diff);
      // TODO: Trigger animation (e.g., highlight or bounce)
    }
  }, [changes?.walletChanges, userId]);

  if (!wallet) {
    return <div>Loading wallet...</div>;
  }

  return (
    <div className="wallet-display">
      <h3>Balance</h3>
      <div>
        {Object.entries(wallet).map(([currency, balance]) => (
          <div key={currency} className="balance-row">
            <span>{currency}:</span>
            <span className="amount">{balance.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '12px', marginTop: '10px' }}>
        {isConnected ? '✓ Live' : '⚠ Offline (cached)'}
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: Transaction History
// ============================================================================

export function TransactionHistory() {
  const { state, changes } = useWebSocket();
  const [history, setHistory] = useState([]);

  // Auto-update history when new transactions settle
  useEffect(() => {
    if (!changes?.transactionChanges) return;

    const { added, settled } = changes.transactionChanges;

    // Add new pending transactions
    if (added && added.length > 0) {
      console.log(`[History] New transactions:`, added);
      setHistory(prev => [...added, ...prev]);
    }

    // Update when transactions settle
    if (settled && settled.length > 0) {
      console.log(`[History] Settled transactions:`, settled);
      setHistory(prev =>
        prev.map(tx =>
          settled.some(s => s.id === tx.id) ? { ...tx, status: 'settled' } : tx
        )
      );
    }
  }, [changes?.transactionChanges]);

  return (
    <div className="transaction-history">
      <h3>Recent Transfers</h3>
      <table>
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {history.slice(0, 10).map(tx => (
            <tr key={tx.id} className={`tx-${tx.status}`}>
              <td>{state?.users?.[tx.senderID]?.username || 'Unknown'}</td>
              <td>{state?.users?.[tx.receiverID]?.username || 'Unknown'}</td>
              <td>{tx.amount} {tx.currencyID}</td>
              <td>
                {tx.status === 'pending' && '⏳ Pending'}
                {tx.status === 'settled' && '✓ Settled'}
                {tx.status === 'failed' && '✗ Failed'}
              </td>
              <td>{new Date(tx.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Multi-Component App Integration
// ============================================================================

export function App() {
  return (
    <div className="kronos-dashboard">
      <header>
        <h1>Kronos - 3D Space Finance</h1>
        <ConnectionStatus />
      </header>

      <div className="layout">
        {/* Main 3D viewport */}
        <section className="main-viewport">
          <Scene3D />
        </section>

        {/* Sidebar with wallet and transactions */}
        <aside className="sidebar">
          <WalletUI userId={getCurrentUserId()} />
          <hr />
          <TransactionHistory />
        </aside>
      </div>
    </div>
  );
}

function ConnectionStatus() {
  const { isConnected } = useWebSocket();

  return (
    <div
      style={{
        display: 'inline-block',
        padding: '8px 12px',
        borderRadius: '4px',
        backgroundColor: isConnected ? '#4CAF50' : '#FF9800',
        color: 'white',
        fontSize: '12px'
      }}
    >
      {isConnected ? '🟢 Live' : '🟡 Reconnecting...'}
    </div>
  );
}

function getCurrentUserId() {
  // Get from auth context or localStorage
  return localStorage.getItem('userId');
}

// ============================================================================
// EXAMPLE 5: Direct Manager Usage (without React hook)
// ============================================================================

import WebSocketManager from '../services/WebSocketManager';

export function InitializeWebSocket() {
  const manager = WebSocketManager.getInstance();

  // Connect once on app startup
  manager.connect('ws://localhost:8080/ws');

  // Subscribe to all updates
  const unsubscribe = manager.subscribe((state, changes) => {
    console.log('[App] State updated:', {
      packetCount: state.packets.length,
      changes: changes._changes
    });

    // Process packets
    if (changes._changes?.packetChanges?.added?.length > 0) {
      console.log('New packets:', changes._changes.packetChanges.added);
    }

    // Process wallet changes
    if (changes._changes?.walletChanges?.length > 0) {
      console.log('Wallet changes:', changes._changes.walletChanges);
    }

    // Process transaction changes
    if (changes._changes?.transactionChanges?.settled?.length > 0) {
      console.log('Settled transactions:', changes._changes.transactionChanges.settled);
    }
  });

  // Cleanup on unmount
  return () => {
    unsubscribe();
    // Optionally disconnect: manager.disconnect();
  };
}

// ============================================================================
// INTEGRATION CHECKLIST
// ============================================================================

/*
TODO:
□ Import useWebSocket hook in each component that needs real-time data
□ Use state.packets for 3D scene updates
□ Use state.wallets for balance displays
□ Use state.transactions for history/audit trails
□ Use changes.packetChanges for efficient mesh updates (don't re-render entire scene)
□ Use changes.walletChanges for wallet animations
□ Use changes.transactionChanges for transaction status updates
□ Test auto-reconnect by unplugging network / killing backend server
□ Add visual indicators for connection status (green/red dot)
□ Add error UI for when connection fails after max retries
□ Test with slow network (devtools throttling)
□ Test with large packet counts (>100)
□ Monitor memory usage with continuous updates
□ Add logging/analytics for connection events
*/
