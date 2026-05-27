import { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';

const STATUS_ICON = {
  settled: <CheckCircle size={13} style={{ color: '#4ade80' }} />,
  pending: <Clock size={13} style={{ color: '#fbbf24' }} />,
  failed:  <XCircle size={13} style={{ color: '#ef4444' }} />,
};

const STATUS_COLOR = {
  settled: '#4ade80',
  pending: '#fbbf24',
  failed:  '#ef4444',
};

function timeAgo(isoDate) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/me/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="tx-history">
      <div className="tx-history-header">
        <span className="tx-history-title">Transaction History</span>
        <button className="tx-refresh-btn" onClick={fetchHistory} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {loading && (
        <div className="tx-loading">Loading...</div>
      )}

      {error && (
        <div className="tx-error">{error}</div>
      )}

      {!loading && !error && transactions.length === 0 && (
        <div className="tx-empty">No transactions yet</div>
      )}

      {!loading && transactions.length > 0 && (
        <div className="tx-list">
          {transactions.map((tx) => (
            <div key={tx.transaction_id} className="tx-item">
              <div className="tx-direction">
                {tx.transaction_type === 'sent' ? (
                  <ArrowUpRight size={16} style={{ color: '#f87171' }} />
                ) : (
                  <ArrowDownLeft size={16} style={{ color: '#4ade80' }} />
                )}
              </div>
              <div className="tx-details">
                <div className="tx-party">
                  <span className="tx-type-label">
                    {tx.transaction_type === 'sent' ? 'To' : 'From'}
                  </span>
                  <span className="tx-username">{tx.other_party_username}</span>
                </div>
                <div className="tx-meta">
                  <span className="tx-planet">{tx.planet}</span>
                  <span className="tx-time">{timeAgo(tx.created_at)}</span>
                </div>
              </div>
              <div className="tx-right">
                <div
                  className="tx-amount"
                  style={{ color: tx.transaction_type === 'sent' ? '#f87171' : '#4ade80' }}
                >
                  {tx.transaction_type === 'sent' ? '-' : '+'}{tx.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </div>
                <div className="tx-status" style={{ color: STATUS_COLOR[tx.status] }}>
                  {STATUS_ICON[tx.status]}
                  <span>{tx.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
