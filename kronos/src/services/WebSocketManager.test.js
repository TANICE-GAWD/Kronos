/**
 * WebSocketManager Test Utility
 *
 * Use this to test the WebSocket connection and state updates without React.
 * Run in browser console or in a test file.
 *
 * Example:
 *   import { testWebSocketManager } from './services/WebSocketManager.test.js';
 *   testWebSocketManager('ws://localhost:8080/ws');
 */

import WebSocketManager from './WebSocketManager';

export async function testWebSocketManager(wsUrl = 'ws://localhost:8080/ws') {
  console.log('=== WebSocketManager Test Suite ===\n');

  const manager = WebSocketManager.getInstance();

  // Test 1: Connection
  console.log('TEST 1: Connection');
  console.log('Connecting to', wsUrl);
  
  return new Promise((resolve) => {
    let updateCount = 0;
    const maxUpdates = 5;

    // Subscribe to updates
    const unsubscribe = manager.subscribe((state, changes) => {
      updateCount++;
      
      console.log(`\n[Update #${updateCount}] State received:`, {
        packetCount: state.packets?.length || 0,
        walletCount: Object.keys(state.wallets || {}).length,
        transactionCount: state.transactions?.length || 0,
        timestamp: new Date(state.timestamp).toLocaleTimeString()
      });

      if (changes._changes) {
        const pc = changes._changes.packetChanges;
        const wc = changes._changes.walletChanges;
        const tc = changes._changes.transactionChanges;

        console.log('Changes detected:', {
          packetsAdded: pc?.added?.length || 0,
          packetsUpdated: pc?.updated?.length || 0,
          packetsRemoved: pc?.removed?.length || 0,
          walletsChanged: wc?.length || 0,
          transactionsChanaged: tc?.added?.length || 0,
          transactionsSettled: tc?.settled?.length || 0
        });

        // Sample packet details
        if (pc?.added?.length > 0) {
          const packet = pc.added[0];
          console.log('Sample new packet:', {
            id: packet.id,
            from: packet.originPlanet,
            to: packet.destinationPlanet,
            amount: packet.payload?.amount,
            status: packet.status
          });
        }

        // Sample wallet change
        if (wc?.length > 0) {
          const change = wc[0];
          if (change.diff) {
            console.log('Sample wallet change:', change.diff);
          }
        }
      }

      // Stop after N updates
      if (updateCount >= maxUpdates) {
        console.log(`\n✓ Received ${updateCount} updates`);
        unsubscribe();
        resolve(true);
      }
    });

    // Connect
    manager.connect(wsUrl);

    // Timeout after 30 seconds
    setTimeout(() => {
      if (updateCount < maxUpdates) {
        console.error(
          `✗ Only received ${updateCount}/${maxUpdates} updates before timeout`
        );
      }
      unsubscribe();
      resolve(true);
    }, 30000);
  });
}

export function testReconnection() {
  console.log('=== WebSocketManager Reconnection Test ===\n');

  const manager = WebSocketManager.getInstance();

  console.log('1. Connecting...');
  manager.connect('ws://localhost:8080/ws');

  // Wait 2 seconds, then simulate network failure
  setTimeout(() => {
    console.log('2. Forcing disconnect to test reconnection...');
    if (manager.ws) {
      manager.ws.close();
    }

    // Monitor reconnection attempts
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      const status = manager.isConnectedToServer() ? '✓ Connected' : '✗ Disconnected';
      console.log(`[${checkCount}s] Status: ${status}`);

      if (manager.isConnectedToServer() || checkCount > 60) {
        clearInterval(checkInterval);
        if (manager.isConnectedToServer()) {
          console.log('\n✓ Successfully reconnected!');
        } else {
          console.log('\n✗ Failed to reconnect after 60 seconds');
        }
      }
    }, 1000);
  }, 2000);
}

export function testStateUpdate() {
  console.log('=== WebSocketManager State Update Test ===\n');

  const manager = WebSocketManager.getInstance();

  // Create mock state
  const mockState1 = {
    packets: [
      {
        id: 'pkt-001',
        originPlanet: 'mars',
        destinationPlanet: 'earth',
        currentPos: [10, 20, 30],
        status: 'active',
        travelT: 0.5,
        payload: { amount: 100, currencyID: 'CREDIT' }
      }
    ],
    wallets: {
      'user-1': { CREDIT: 500 },
      'user-2': { CREDIT: 1000 }
    },
    transactions: [
      {
        id: 'tx-001',
        senderID: 'user-1',
        receiverID: 'user-2',
        amount: 100,
        status: 'pending'
      }
    ],
    users: {
      'user-1': { username: 'alice', homePlanet: 'mars' },
      'user-2': { username: 'bob', homePlanet: 'earth' }
    },
    timestamp: Date.now()
  };

  // Update 1: Move packet
  const mockState2 = JSON.parse(JSON.stringify(mockState1));
  mockState2.packets[0].currentPos = [15, 25, 35];
  mockState2.packets[0].travelT = 0.6;

  // Update 2: Settle transaction
  const mockState3 = JSON.parse(JSON.stringify(mockState2));
  mockState3.packets[0].status = 'settled';
  mockState3.transactions[0].status = 'settled';
  mockState3.wallets['user-1'].CREDIT = 400;
  mockState3.wallets['user-2'].CREDIT = 1100;

  let stateUpdates = 0;
  const unsubscribe = manager.subscribe((state, changes) => {
    stateUpdates++;
    console.log(`\nState Update #${stateUpdates}:`);
    console.log('Current packets:', state.packets.length);
    console.log('Changes:', changes._changes);
  });

  console.log('Simulating state updates...');

  // Simulate server updates
  setTimeout(() => {
    console.log('\nUpdate 1: Packet position changed');
    manager.diffAndUpdate(mockState2);
  }, 500);

  setTimeout(() => {
    console.log('\nUpdate 2: Packet settled, transaction completed');
    manager.diffAndUpdate(mockState3);
  }, 1000);

  setTimeout(() => {
    unsubscribe();
    console.log(`\n✓ Received ${stateUpdates} state updates`);
  }, 2000);
}

// Export all tests for convenient running
export const tests = {
  connection: testWebSocketManager,
  reconnection: testReconnection,
  stateUpdate: testStateUpdate
};
