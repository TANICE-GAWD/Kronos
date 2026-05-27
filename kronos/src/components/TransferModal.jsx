import { useState, useEffect, useRef } from 'react';
import { X, Send, AlertCircle, Loader, Globe } from 'lucide-react';
import { getCurrencyIdForPlanet } from '../utils/planetCurrency';
import WebSocketManager from '../services/WebSocketManager';
import { API_BASE_URL } from '../config';
import '../styles/TransferModal.css';

const currentUserId = () => localStorage.getItem('userId');

// Convert WebSocket users map → sorted array, excluding self
function wsUsersToList(usersMap) {
  const selfId = currentUserId();
  return Object.entries(usersMap || {})
    .filter(([id]) => id !== selfId)
    .map(([, u]) => ({ username: u.username, home_planet: u.homePlanet }))
    .filter(u => u.username)
    .sort((a, b) => a.username.localeCompare(b.username));
}

export default function TransferModal({
  isOpen,
  onClose,
  onTransferComplete,
  planetPositionsRef,
  cameraRef
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]);      // full list from WS state
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);

  const authToken = localStorage.getItem('authToken');

  // Populate allUsers from WebSocket state (already cached, no API call)
  useEffect(() => {
    const manager = WebSocketManager.getInstance();
    const state = manager.getState();
    setAllUsers(wsUsersToList(state.users));

    // Also keep it live as WS state updates
    const unsub = manager.subscribe((newState) => {
      setAllUsers(wsUsersToList(newState.users));
    });
    return unsub;
  }, []);

  // On modal open: reset form and show full user list
  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setSelectedRecipient(null);
    setAmount('');
    setError('');
    setShowDropdown(true);
    setSearchResults(allUsers);
  }, [isOpen]);             // allUsers intentionally omitted — snapshot on open

  // Whenever allUsers updates while modal is already open with no query, refresh list
  useEffect(() => {
    if (isOpen && searchQuery === '') {
      setSearchResults(allUsers);
    }
  }, [allUsers]);

  const searchAPI = async (query) => {
    setIsSearching(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const data = await res.json();
      setSearchResults(res.ok ? (data.results || []) : []);
    } catch {
      // API unreachable — fall back to client-side filter
      const q = query.toLowerCase();
      setSearchResults(allUsers.filter(u => u.username.toLowerCase().startsWith(q)));
    }
    setIsSearching(false);
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    setSelectedRecipient(null);
    setShowDropdown(true);

    if (value === '') {
      setSearchResults(allUsers);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAPI(value), 200);
  };

  const handleSelectRecipient = (recipient) => {
    setSelectedRecipient(recipient);
    setSearchQuery(recipient.username);
    setShowDropdown(false);
    setError('');

    // Tween camera to recipient's planet
    if (cameraRef && cameraRef.current && planetPositionsRef.current[recipient.home_planet]) {
      const planet = planetPositionsRef.current[recipient.home_planet];
      const targetPos = {
        x: planet.x + 150,
        y: planet.y + 100,
        z: planet.z + 150,
      };

      
      const startPos = cameraRef.current.position.clone();
      const startTime = Date.now();
      const duration = 1500; 

      const tweenCamera = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        
        const easeProgress =
          progress < 0.5
            ? 2 * progress * progress
            : -1 + (4 - 2 * progress) * progress;

        cameraRef.current.position.x =
          startPos.x + (targetPos.x - startPos.x) * easeProgress;
        cameraRef.current.position.y =
          startPos.y + (targetPos.y - startPos.y) * easeProgress;
        cameraRef.current.position.z =
          startPos.z + (targetPos.z - startPos.z) * easeProgress;
        cameraRef.current.lookAt(planet.x, planet.y, planet.z);

        if (progress < 1) {
          requestAnimationFrame(tweenCamera);
        }
      };

      tweenCamera();
    }
  };

  // Handle transfer submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedRecipient) {
      setError('Please select a recipient');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          receiver_username: selectedRecipient.username,
          amount: parseFloat(amount),
          currency_id: getCurrencyIdForPlanet(selectedRecipient.home_planet),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Transfer failed');
        setIsLoading(false);
        return;
      }

      
      onTransferComplete?.({
        recipient: selectedRecipient.username,
        amount: parseFloat(amount),
        planet: selectedRecipient.home_planet,
      });

      
      setSelectedRecipient(null);
      setSearchQuery('');
      setAmount('');
      setIsLoading(false);
      onClose();
    } catch (err) {
      setError('Failed to connect to server: ' + err.message);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="transfer-modal-overlay" onClick={onClose}>
      <div className="transfer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="transfer-modal-header">
          <h2>
            <Send size={20} style={{ display: 'inline', marginRight: '10px' }} />
            Send Credits
          </h2>
          <button
            className="transfer-modal-close"
            onClick={onClose}
            disabled={isLoading}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="transfer-form">
          
          <div className="form-group">
            <label htmlFor="recipient-search">Recipient (Galactic Handle)</label>
            <div className="search-container">
              <input
                id="recipient-search"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                placeholder="All users shown — type to filter..."
                disabled={isLoading}
                autoComplete="off"
              />
              {isSearching && <Loader size={16} className="search-spinner" />}
            </div>

            {showDropdown && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result) => (
                  <div
                    key={result.username}
                    className={`search-result-item ${selectedRecipient?.username === result.username ? 'selected' : ''}`}
                    onMouseDown={() => handleSelectRecipient(result)}
                  >
                    <span className="result-username">{result.username}</span>
                    <span className="result-planet">
                      <Globe size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      {result.home_planet}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          
          {selectedRecipient && (
            <div className="recipient-info">
              <p>
                <strong>To:</strong> {selectedRecipient.username}
              </p>
              <p>
                <strong>Planet:</strong> <Globe size={14} style={{ display: 'inline', marginRight: '4px' }} /> {selectedRecipient.home_planet}
              </p>
              <p>
                <strong>Currency:</strong> {getCurrencyIdForPlanet(selectedRecipient.home_planet)}
              </p>
            </div>
          )}

              Amount ({selectedRecipient ? getCurrencyIdForPlanet(selectedRecipient.home_planet) : 'CREDIT'})
            
          
          <div className="form-group">
            <label htmlFor="amount">Amount (CREDIT)</label>
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} style={{ display: 'inline', marginRight: '8px' }} />
              {error}
            </div>
          )}

          <button
            className="send-button"
            disabled={isLoading || !selectedRecipient || !amount}
          >
            {isLoading ? (
              <>
                <Loader size={16} className="spin" />
                Launching...
              </>
            ) : (
              <>
                <Send size={16} />
                Launch Transaction
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
