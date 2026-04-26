import { useState, useEffect } from 'react';
import WebSocketManager from '../services/WebSocketManager';
import '../styles/WalletUI.css';

export default function WalletUI() {
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  const [balance, setBalance] = useState(0);
  const [previousBalance, setPreviousBalance] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [changeDirection, setChangeDirection] = useState(null); // 'increase', 'decrease', or null
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId) {
      console.warn('[WalletUI] No userId found in localStorage');
      return;
    }

    const manager = WebSocketManager.getInstance();

    // Subscribe to state updates
    const unsubscribe = manager.subscribe((state, changes) => {
      setIsConnected(manager.isConnected);

      // Check if this user's wallet exists
      if (state.wallets && state.wallets[userId]) {
        const wallet = state.wallets[userId];
        const newBalance = wallet.available_balance;

        // Update balance with proper state comparison
        setBalance(prevBalance => {
          if (newBalance !== prevBalance) {
            setPreviousBalance(prevBalance);

            // Determine direction of change
            if (newBalance > prevBalance) {
              setChangeDirection('increase');
            } else if (newBalance < prevBalance) {
              setChangeDirection('decrease');
            }

            // Trigger animation
            setIsAnimating(true);

            // Remove animation after duration
            const animationTimer = setTimeout(() => {
              setIsAnimating(false);
              setChangeDirection(null);
            }, 1500);

            return newBalance;
          }
          return prevBalance;
        });
      }
    });

    // Connect WebSocket if not already connected
    if (!manager.isConnected && !manager.ws) {
      console.log('[WalletUI] Connecting to WebSocket...');
      manager.connect('ws://localhost:8080/ws');
    }

    return unsubscribe;
  }, [userId]);

  if (!userId) {
    return null;
  }

  const formattedBalance = balance.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const changeAmount = Math.abs(balance - previousBalance);
  const formattedChangeAmount = changeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <div className="wallet-container">
      <div className="wallet-card">
        {/* Connection Status Indicator */}
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {isConnected ? 'Connected' : 'Reconnecting...'}
          </span>
        </div>

        {/* Wallet Header */}
        <div className="wallet-header">
          <h2 className="wallet-title">💰 Wallet</h2>
          <p className="wallet-username">{username}</p>
        </div>

        {/* Balance Display */}
        <div className="balance-section">
          <p className="balance-label">Available Balance</p>
          <div className={`balance-amount ${isAnimating ? `animate-${changeDirection}` : ''}`}>
            <span className="currency-symbol">⭐</span>
            <span className="balance-value">{formattedBalance}</span>
            <span className="currency-code">CREDIT</span>
          </div>
        </div>

        {/* Change Indicator */}
        {isAnimating && (
          <div className={`change-indicator ${changeDirection}`}>
            <span className="change-arrow">
              {changeDirection === 'increase' ? '📈' : '📉'}
            </span>
            <span className="change-text">
              {changeDirection === 'increase' ? '+' : '-'}
              {formattedChangeAmount}
            </span>
          </div>
        )}

        {/* Balance Status */}
        <div className="balance-status">
          {balance > 1000 && (
            <p className="status-text status-excellent">
              ✨ Excellent balance
            </p>
          )}
          {balance > 500 && balance <= 1000 && (
            <p className="status-text status-good">
              ✓ Good balance
            </p>
          )}
          {balance > 100 && balance <= 500 && (
            <p className="status-text status-moderate">
              ⚠ Moderate balance
            </p>
          )}
          {balance > 0 && balance <= 100 && (
            <p className="status-text status-low">
              ⚠ Low balance
            </p>
          )}
          {balance === 0 && (
            <p className="status-text status-empty">
              ✗ No balance
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
