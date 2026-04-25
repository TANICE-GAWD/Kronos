/**
 * WebSocketManager
 *
 * Manages WebSocket connection to the Kronos backend /ws endpoint.
 * Responsibilities:
 * - Connection persistence with auto-reconnect
 * - State management (packets, wallets, transactions)
 * - Subscriber pattern for UI components
 * - Efficient diffing engine to detect changes
 *
 * Usage:
 *   const manager = WebSocketManager.getInstance();
 *   manager.subscribe((state) => console.log(state));
 *   manager.connect('ws://localhost:8080/ws');
 */

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.url = null;
    this.subscribers = new Set();
    
    // Current state from server
    this.state = {
      packets: [],           // Active 3D packets in transit
      wallets: {},           // User wallets {userID: {currency: balance}}
      transactions: [],      // Recent transactions
      users: {},            // User info {userID: {username, homePlanet}}
      timestamp: null
    };

    // Reconnect strategy
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 1000; // 1 second
    this.reconnectTimeout = null;

    // Connection state
    this.isConnected = false;
    this.isManualClose = false;
  }

  /**
   * Singleton instance
   */
  static getInstance() {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Connect to the WebSocket server
   * @param {string} url - WebSocket URL (e.g., 'ws://localhost:8080/ws')
   */
  connect(url) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('[WebSocketManager] Already connected');
      return;
    }

    this.url = url;
    this.isManualClose = false;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror = (error) => this.handleError(error);
      this.ws.onclose = () => this.handleClose();
    } catch (err) {
      console.error('[WebSocketManager] Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open
   */
  handleOpen() {
    console.log('[WebSocketManager] Connected to', this.url);
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Notify all subscribers of connection state
    this.notifySubscribers();
  }

  /**
   * Handle incoming message from server
   * @param {MessageEvent} event
   */
  handleMessage(event) {
    try {
      const newState = JSON.parse(event.data);

      // Validate state structure
      if (!newState.packets || !newState.wallets) {
        console.warn('[WebSocketManager] Invalid state structure:', newState);
        return;
      }

      // Diff and update state
      this.diffAndUpdate(newState);

      // Notify all subscribers
      this.notifySubscribers();
    } catch (err) {
      console.error('[WebSocketManager] Failed to parse message:', err, event.data);
    }
  }

  /**
   * Diff engine: Compare old state with new state and detect changes
   * @param {object} newState - New state from server
   */
  diffAndUpdate(newState) {
    const changes = {
      packetChanges: this.diffPackets(this.state.packets, newState.packets),
      walletChanges: this.diffWallets(this.state.wallets, newState.wallets),
      transactionChanges: this.diffTransactions(
        this.state.transactions,
        newState.transactions
      )
    };

    // Store changes for subscribers to process
    this.state.packets = newState.packets;
    this.state.wallets = newState.wallets;
    this.state.transactions = newState.transactions;
    this.state.users = newState.users || {};
    this.state.timestamp = newState.timestamp || Date.now();

    // Attach changes to state for efficient processing
    this.state._changes = changes;
  }

  /**
   * Diff packets: Detect added, updated, removed packets
   * @returns {object} { added: [], updated: [], removed: [] }
   */
  diffPackets(oldPackets, newPackets) {
    const oldMap = new Map(oldPackets.map(p => [p.id, p]));
    const newMap = new Map(newPackets.map(p => [p.id, p]));

    const added = [];
    const updated = [];
    const removed = [];

    // Find added and updated packets
    for (const [id, newPacket] of newMap) {
      const oldPacket = oldMap.get(id);
      if (!oldPacket) {
        added.push(newPacket);
      } else if (!this.packetsEqual(oldPacket, newPacket)) {
        updated.push({
          id,
          old: oldPacket,
          new: newPacket,
          changes: this.detectPacketChanges(oldPacket, newPacket)
        });
      }
    }

    // Find removed packets
    for (const [id, oldPacket] of oldMap) {
      if (!newMap.has(id)) {
        removed.push(oldPacket);
      }
    }

    return { added, updated, removed };
  }

  /**
   * Detect what specifically changed in a packet
   */
  detectPacketChanges(oldPacket, newPacket) {
    const changes = {};

    if (oldPacket.currentPos !== newPacket.currentPos) {
      changes.positionChanged = true;
      changes.oldPos = oldPacket.currentPos;
      changes.newPos = newPacket.currentPos;
    }

    if (oldPacket.status !== newPacket.status) {
      changes.statusChanged = true;
      changes.oldStatus = oldPacket.status;
      changes.newStatus = newPacket.status;
    }

    if (oldPacket.travelT !== newPacket.travelT) {
      changes.progressChanged = true;
      changes.oldProgress = oldPacket.travelT;
      changes.newProgress = newPacket.travelT;
    }

    return changes;
  }

  /**
   * Check if two packets are equal
   */
  packetsEqual(p1, p2) {
    return (
      p1.id === p2.id &&
      p1.status === p2.status &&
      JSON.stringify(p1.currentPos) === JSON.stringify(p2.currentPos) &&
      p1.travelT === p2.travelT
    );
  }

  /**
   * Diff wallets: Detect balance changes
   * @returns {object} { changed: [] }
   */
  diffWallets(oldWallets, newWallets) {
    const changed = [];

    for (const [userId, newWallet] of Object.entries(newWallets)) {
      const oldWallet = oldWallets[userId];

      if (!oldWallet) {
        // New wallet
        changed.push({
          userId,
          type: 'added',
          wallet: newWallet
        });
      } else if (oldWallet !== newWallet) {
        // Wallet changed
        changed.push({
          userId,
          type: 'updated',
          oldWallet,
          newWallet,
          diff: this.detectWalletChanges(oldWallet, newWallet)
        });
      }
    }

    // Check for removed wallets
    for (const userId of Object.keys(oldWallets)) {
      if (!newWallets[userId]) {
        changed.push({
          userId,
          type: 'removed',
          wallet: oldWallets[userId]
        });
      }
    }

    return changed;
  }

  /**
   * Detect specific wallet changes
   */
  detectWalletChanges(oldWallet, newWallet) {
    const changes = {};

    for (const [currency, oldBalance] of Object.entries(oldWallet)) {
      const newBalance = newWallet[currency];
      if (newBalance !== oldBalance) {
        changes[currency] = {
          old: oldBalance,
          new: newBalance,
          delta: newBalance - oldBalance
        };
      }
    }

    return changes;
  }

  /**
   * Diff transactions: Detect new/settled transactions
   * @returns {object} { added: [], settled: [] }
   */
  diffTransactions(oldTransactions, newTransactions) {
    const oldMap = new Map(oldTransactions.map(t => [t.id, t]));
    const newMap = new Map(newTransactions.map(t => [t.id, t]));

    const added = [];
    const settled = [];

    for (const [id, newTx] of newMap) {
      const oldTx = oldMap.get(id);

      if (!oldTx) {
        // New transaction
        added.push(newTx);
      } else if (oldTx.status !== newTx.status) {
        // Transaction status changed
        if (newTx.status === 'settled') {
          settled.push({
            id,
            transaction: newTx
          });
        }
      }
    }

    return { added, settled };
  }

  /**
   * Handle WebSocket error
   */
  handleError(error) {
    console.error('[WebSocketManager] WebSocket error:', error);
    this.scheduleReconnect();
  }

  /**
   * Handle WebSocket close
   */
  handleClose() {
    console.log('[WebSocketManager] Connection closed');
    this.isConnected = false;

    if (!this.isManualClose) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule automatic reconnect with exponential backoff
   */
  scheduleReconnect() {
    if (this.isManualClose || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        '[WebSocketManager] Max reconnect attempts reached or manual close',
        this.reconnectAttempts
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Cap at 30 seconds
    );

    console.log(
      `[WebSocketManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      if (!this.isManualClose && !this.isConnected) {
        this.connect(this.url);
      }
    }, delay);
  }

  /**
   * Subscribe to state updates
   * @param {function} callback - Called with (state, changes) whenever state updates
   * @returns {function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of state change
   */
  notifySubscribers() {
    for (const callback of this.subscribers) {
      try {
        callback(this.state, this.state._changes);
      } catch (err) {
        console.error('[WebSocketManager] Error in subscriber callback:', err);
      }
    }
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get connection status
   */
  isConnectedToServer() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Manually disconnect
   */
  disconnect() {
    this.isManualClose = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    console.log('[WebSocketManager] Manually disconnected');
  }

  /**
   * Reconnect after manual disconnect
   */
  reconnect() {
    if (!this.url) {
      console.error('[WebSocketManager] No URL set, cannot reconnect');
      return;
    }

    this.isManualClose = false;
    this.reconnectAttempts = 0;
    this.connect(this.url);
  }

  /**
   * Send message to server (for future use)
   */
  send(message) {
    if (!this.isConnectedToServer()) {
      console.warn('[WebSocketManager] Not connected, cannot send message');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error('[WebSocketManager] Failed to send message:', err);
      return false;
    }
  }
}

export default WebSocketManager;
