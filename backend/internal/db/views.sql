-- ============================================================================
-- KRONOS DATABASE - VIEWS
-- Database Views for Reporting, Analysis, and Simplified Data Access
-- ============================================================================

-- ============================================================================
-- VIEW 1: v_user_wallet_summary
-- Comprehensive wallet overview for each user
-- ============================================================================
CREATE OR REPLACE VIEW v_user_wallet_summary AS
SELECT 
    u.id as user_id,
    u.username,
    u.home_planet,
    w.id as wallet_id,
    w.currency_id,
    c.name as currency_name,
    c.symbol as currency_symbol,
    w.available_balance,
    w.locked_balance,
    w.available_balance + w.locked_balance as total_balance,
    w.created_at as wallet_created_at,
    w.updated_at as wallet_updated_at
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
LEFT JOIN currencies c ON w.currency_id = c.id
WHERE c.is_active = TRUE
ORDER BY u.username, c.name;

-- ============================================================================
-- VIEW 2: v_transaction_details
-- Rich transaction details with user and planet information
-- ============================================================================
CREATE OR REPLACE VIEW v_transaction_details AS
SELECT 
    t.id as transaction_id,
    t.sender_id,
    sender_user.username as sender_username,
    t.receiver_id,
    receiver_user.username as receiver_username,
    t.amount,
    t.status,
    t.origin_planet,
    t.destination_planet,
    t.created_at,
    t.updated_at,
    (t.updated_at - t.created_at) as duration
FROM transactions t
LEFT JOIN users sender_user ON t.sender_id = sender_user.id
LEFT JOIN users receiver_user ON t.receiver_id = receiver_user.id
ORDER BY t.created_at DESC;

-- ============================================================================
-- VIEW 3: v_pending_transactions
-- All transactions awaiting settlement
-- ============================================================================
CREATE OR REPLACE VIEW v_pending_transactions AS
SELECT 
    t.id as transaction_id,
    sender_user.username as sender_username,
    receiver_user.username as receiver_username,
    t.amount,
    t.origin_planet,
    t.destination_planet,
    t.created_at,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.created_at)) / 3600 as pending_hours
FROM transactions t
LEFT JOIN users sender_user ON t.sender_id = sender_user.id
LEFT JOIN users receiver_user ON t.receiver_id = receiver_user.id
WHERE t.status = 'pending'
ORDER BY t.created_at ASC;

-- ============================================================================
-- VIEW 4: v_user_transaction_history
-- Complete transaction history for each user (as sender and receiver)
-- ============================================================================
CREATE OR REPLACE VIEW v_user_transaction_history AS
SELECT 
    u.id as user_id,
    u.username,
    t.id as transaction_id,
    CASE 
        WHEN u.id = t.sender_id THEN 'sent'
        WHEN u.id = t.receiver_id THEN 'received'
    END as transaction_type,
    CASE 
        WHEN u.id = t.sender_id THEN receiver_user.username
        WHEN u.id = t.receiver_id THEN sender_user.username
    END as other_party_username,
    t.amount,
    t.status,
    CASE 
        WHEN u.id = t.sender_id THEN t.origin_planet
        WHEN u.id = t.receiver_id THEN t.destination_planet
    END as planet,
    t.created_at,
    t.updated_at
FROM users u
LEFT JOIN transactions t ON u.id = t.sender_id OR u.id = t.receiver_id
LEFT JOIN users sender_user ON t.sender_id = sender_user.id
LEFT JOIN users receiver_user ON t.receiver_id = receiver_user.id
WHERE t.id IS NOT NULL
ORDER BY u.username, t.created_at DESC;

-- ============================================================================
-- VIEW 5: v_daily_volumes
-- Daily transaction volume and value analysis
-- ============================================================================
CREATE OR REPLACE VIEW v_daily_volumes AS
SELECT 
    DATE(t.created_at) as transaction_date,
    COUNT(t.id) as transaction_count,
    SUM(t.amount) as total_volume,
    AVG(t.amount) as avg_transaction,
    MIN(t.amount) as min_transaction,
    MAX(t.amount) as max_transaction,
    SUM(CASE WHEN t.status = 'settled' THEN 1 ELSE 0 END) as settled_count,
    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_count
FROM transactions t
GROUP BY DATE(t.created_at)
ORDER BY transaction_date DESC;

-- ============================================================================
-- VIEW 6: v_user_wealth_summary
-- User total wealth across all currencies
-- ============================================================================
CREATE OR REPLACE VIEW v_user_wealth_summary AS
SELECT 
    u.id as user_id,
    u.username,
    u.home_planet,
    COUNT(DISTINCT w.currency_id) as active_currencies,
    SUM(w.available_balance) as total_available,
    SUM(w.locked_balance) as total_locked,
    SUM(w.available_balance + w.locked_balance) as total_wealth,
    MIN(w.created_at) as oldest_wallet,
    MAX(w.updated_at) as last_update
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
LEFT JOIN currencies c ON w.currency_id = c.id AND c.is_active = TRUE
GROUP BY u.id, u.username, u.home_planet
ORDER BY total_wealth DESC;

-- ============================================================================
-- VIEW 7: v_currency_summary
-- Statistics for each currency
-- ============================================================================
CREATE OR REPLACE VIEW v_currency_summary AS
SELECT 
    c.id as currency_id,
    c.name,
    c.planet_name,
    c.symbol,
    COUNT(DISTINCT w.user_id) as user_count,
    COUNT(DISTINCT w.id) as wallet_count,
    SUM(w.available_balance) as total_available,
    SUM(w.locked_balance) as total_locked,
    SUM(w.available_balance + w.locked_balance) as total_supply,
    AVG(w.available_balance) as avg_balance_per_wallet,
    c.is_active,
    c.created_at
FROM currencies c
LEFT JOIN wallets w ON c.id = w.currency_id
GROUP BY c.id, c.name, c.planet_name, c.symbol, c.is_active, c.created_at
ORDER BY total_supply DESC NULLS LAST;

-- ============================================================================
-- VIEW 8: v_ledger_summary
-- Ledger entries with transaction context
-- ============================================================================
CREATE OR REPLACE VIEW v_ledger_summary AS
SELECT 
    le.id as entry_id,
    le.wallet_id,
    w.user_id,
    u.username,
    w.currency_id,
    le.transaction_id,
    le.entry_type,
    le.amount,
    le.balance_after,
    le.description,
    le.created_at
FROM ledger_entries le
LEFT JOIN wallets w ON le.wallet_id = w.id
LEFT JOIN users u ON w.user_id = u.id
ORDER BY le.created_at DESC;

-- ============================================================================
-- VIEW 9: v_transaction_status_history
-- Audit trail showing transaction status changes
-- ============================================================================
CREATE OR REPLACE VIEW v_transaction_status_history AS
SELECT 
    th.id as history_id,
    th.transaction_id,
    t.sender_id,
    sender_user.username as sender_username,
    t.receiver_id,
    receiver_user.username as receiver_username,
    t.amount,
    th.old_status as previous_status,
    th.new_status as current_status,
    th.changed_by,
    th.changed_at,
    t.created_at as transaction_created_at
FROM transaction_history th
LEFT JOIN transactions t ON th.transaction_id = t.id
LEFT JOIN users sender_user ON t.sender_id = sender_user.id
LEFT JOIN users receiver_user ON t.receiver_id = receiver_user.id
ORDER BY th.changed_at DESC;

-- ============================================================================
-- VIEW 10: v_user_activity_summary
-- User activity audit log with summarization
-- ============================================================================
CREATE OR REPLACE VIEW v_user_activity_summary AS
SELECT 
    ua.id as activity_id,
    ua.user_id,
    u.username,
    ua.activity_type,
    ua.activity_details,
    ua.ip_address,
    ua.created_at,
    DATE(ua.created_at) as activity_date
FROM user_activities ua
LEFT JOIN users u ON ua.user_id = u.id
ORDER BY ua.created_at DESC;

-- ============================================================================
-- VIEW 11: v_top_transactors
-- Users with highest transaction activity
-- ============================================================================
CREATE OR REPLACE VIEW v_top_transactors AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(CASE WHEN t.sender_id = u.id THEN 1 END) as sent_count,
    COUNT(CASE WHEN t.receiver_id = u.id THEN 1 END) as received_count,
    COUNT(t.id) as total_transactions,
    SUM(CASE WHEN t.sender_id = u.id THEN t.amount ELSE 0 END) as total_sent,
    SUM(CASE WHEN t.receiver_id = u.id THEN t.amount ELSE 0 END) as total_received,
    MAX(CASE WHEN t.sender_id = u.id THEN t.created_at 
             WHEN t.receiver_id = u.id THEN t.created_at 
        END) as last_transaction_date
FROM users u
LEFT JOIN transactions t ON u.id = t.sender_id OR u.id = t.receiver_id
GROUP BY u.id, u.username
HAVING COUNT(t.id) > 0
ORDER BY total_transactions DESC;

-- ============================================================================
-- VIEW 12: v_failed_transactions
-- All failed or voided transactions for audit
-- ============================================================================
CREATE OR REPLACE VIEW v_failed_transactions AS
SELECT 
    t.id as transaction_id,
    sender_user.username as sender_username,
    receiver_user.username as receiver_username,
    t.amount,
    t.status,
    t.origin_planet,
    t.destination_planet,
    t.created_at,
    t.updated_at,
    EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) as duration_seconds
FROM transactions t
LEFT JOIN users sender_user ON t.sender_id = sender_user.id
LEFT JOIN users receiver_user ON t.receiver_id = receiver_user.id
WHERE t.status IN ('failed')
ORDER BY t.updated_at DESC;

-- ============================================================================
-- VIEW 13: v_wallet_balance_by_planet
-- Aggregated balances grouped by planet/currency
-- ============================================================================
CREATE OR REPLACE VIEW v_wallet_balance_by_planet AS
SELECT 
    c.planet_name,
    c.id as currency_id,
    c.name as currency_name,
    c.symbol,
    COUNT(DISTINCT w.user_id) as user_count,
    SUM(w.available_balance) as total_available,
    SUM(w.locked_balance) as total_locked,
    SUM(w.available_balance + w.locked_balance) as total_in_circulation,
    ROUND(AVG(w.available_balance + w.locked_balance), 2) as avg_per_user
FROM currencies c
LEFT JOIN wallets w ON c.id = w.currency_id
WHERE c.is_active = TRUE
GROUP BY c.planet_name, c.id, c.name, c.symbol
ORDER BY total_in_circulation DESC NULLS LAST;

-- ============================================================================
-- END OF VIEWS
-- ============================================================================
