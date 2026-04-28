-- ============================================================================
-- KRONOS DATABASE - STORED PROCEDURES
-- PL/pgSQL Procedures for Business Operations
-- ============================================================================

-- ============================================================================
-- PROCEDURE 1: sp_transfer_funds
-- Purpose: Atomic fund transfer with full ACID compliance
-- Parameters:
--   p_sender_id: UUID of sending user
--   p_receiver_id: UUID of receiving user  
--   p_amount: Amount to transfer
--   p_currency_id: Currency code (e.g., 'EARTH', 'MARS')
--   p_origin_planet: Sending planet name
--   p_destination_planet: Receiving planet name
-- Returns: Transaction ID if successful, raises exception on failure
-- ============================================================================
CREATE OR REPLACE FUNCTION sp_transfer_funds(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_amount DECIMAL(20, 8),
    p_currency_id VARCHAR(50),
    p_origin_planet VARCHAR(100),
    p_destination_planet VARCHAR(100)
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_sender_wallet_id UUID;
    v_receiver_wallet_id UUID;
    v_sender_balance DECIMAL(20, 8);
    v_receiver_balance DECIMAL(20, 8);
BEGIN
    -- Validation
    IF p_sender_id = p_receiver_id THEN
        RAISE EXCEPTION 'Cannot transfer to same user';
    END IF;
    
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be positive';
    END IF;
    
    -- Check if currency exists
    IF NOT EXISTS (SELECT 1 FROM currencies WHERE id = p_currency_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Currency % does not exist or is inactive', p_currency_id;
    END IF;
    
    -- Get wallet IDs (create if not exists for receiver)
    SELECT id INTO v_sender_wallet_id 
    FROM wallets 
    WHERE user_id = p_sender_id AND currency_id = p_currency_id;
    
    IF v_sender_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Sender does not have a wallet in currency %', p_currency_id;
    END IF;
    
    -- Check sender balance
    SELECT available_balance INTO v_sender_balance 
    FROM wallets 
    WHERE id = v_sender_wallet_id 
    FOR UPDATE;
    
    IF v_sender_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Available: %, Required: %', v_sender_balance, p_amount;
    END IF;
    
    -- Get or create receiver wallet
    SELECT id INTO v_receiver_wallet_id 
    FROM wallets 
    WHERE user_id = p_receiver_id AND currency_id = p_currency_id;
    
    IF v_receiver_wallet_id IS NULL THEN
        -- Create wallet for receiver
        INSERT INTO wallets (user_id, currency_id, available_balance, locked_balance, created_at, updated_at)
        VALUES (p_receiver_id, p_currency_id, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id INTO v_receiver_wallet_id;
    END IF;
    
    -- Create transaction record (starts as pending)
    INSERT INTO transactions (
        sender_id, receiver_id, amount, status, 
        origin_planet, destination_planet, 
        created_at, updated_at
    ) VALUES (
        p_sender_id, p_receiver_id, p_amount, 'pending',
        p_origin_planet, p_destination_planet,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) RETURNING id INTO v_transaction_id;
    
    -- Deduct from sender
    UPDATE wallets 
    SET available_balance = available_balance - p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_sender_wallet_id;
    
    -- Log sender debit
    INSERT INTO ledger_entries (wallet_id, transaction_id, entry_type, amount, balance_after, description)
    SELECT id, v_transaction_id, 'debit', p_amount, available_balance, 'Transfer sent'
    FROM wallets WHERE id = v_sender_wallet_id;
    
    -- Log activity
    INSERT INTO user_activities (user_id, activity_type, activity_details)
    VALUES (p_sender_id, 'transfer_initiated', 
        jsonb_build_object('amount', p_amount, 'currency', p_currency_id, 'transaction_id', v_transaction_id));
    
    RETURN v_transaction_id;
    
EXCEPTION WHEN OTHERS THEN
    -- Log error activity
    INSERT INTO user_activities (user_id, activity_type, activity_details)
    VALUES (p_sender_id, 'transfer_failed', 
        jsonb_build_object('error', SQLERRM, 'amount', p_amount, 'currency', p_currency_id));
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROCEDURE 2: sp_settle_transaction
-- Purpose: Settle a pending transaction (atomically credit receiver)
-- Parameters:
--   p_transaction_id: UUID of transaction to settle
-- Returns: TRUE if settled, FALSE if already settled/failed
-- ============================================================================
CREATE OR REPLACE FUNCTION sp_settle_transaction(p_transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_sender_id UUID;
    v_receiver_id UUID;
    v_amount DECIMAL(20, 8);
    v_currency_id VARCHAR(50);
    v_status VARCHAR(50);
    v_receiver_wallet_id UUID;
BEGIN
    -- Get transaction details
    SELECT sender_id, receiver_id, amount, status INTO v_sender_id, v_receiver_id, v_amount, v_status
    FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
    END IF;
    
    -- Only settle if pending
    IF v_status != 'pending' THEN
        RETURN FALSE;
    END IF;
    
    -- Get receiver wallet ID and currency
    SELECT w.id, w.currency_id INTO v_receiver_wallet_id, v_currency_id
    FROM wallets w
    WHERE w.user_id = v_receiver_id
    LIMIT 1;
    
    IF v_receiver_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Receiver wallet not found';
    END IF;
    
    -- Credit receiver
    UPDATE wallets 
    SET available_balance = available_balance + v_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_receiver_wallet_id;
    
    -- Log receiver credit
    INSERT INTO ledger_entries (wallet_id, transaction_id, entry_type, amount, balance_after, description)
    SELECT id, p_transaction_id, 'credit', v_amount, available_balance, 'Transfer received'
    FROM wallets WHERE id = v_receiver_wallet_id;
    
    -- Update transaction status
    UPDATE transactions
    SET status = 'settled', updated_at = CURRENT_TIMESTAMP
    WHERE id = p_transaction_id;
    
    -- Log activity
    INSERT INTO user_activities (user_id, activity_type, activity_details)
    VALUES (v_receiver_id, 'transfer_received', 
        jsonb_build_object('amount', v_amount, 'transaction_id', p_transaction_id));
    
    RETURN TRUE;
    
EXCEPTION WHEN OTHERS THEN
    -- Mark transaction as failed
    UPDATE transactions SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = p_transaction_id;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROCEDURE 3: sp_void_transaction
-- Purpose: Void a pending transaction (refund sender)
-- Parameters:
--   p_transaction_id: UUID of transaction to void
-- Returns: TRUE if voided, FALSE if already settled/failed
-- ============================================================================
CREATE OR REPLACE FUNCTION sp_void_transaction(p_transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_sender_id UUID;
    v_amount DECIMAL(20, 8);
    v_status VARCHAR(50);
    v_sender_wallet_id UUID;
BEGIN
    -- Get transaction details
    SELECT sender_id, amount, status INTO v_sender_id, v_amount, v_status
    FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
    END IF;
    
    -- Only void if pending
    IF v_status != 'pending' THEN
        RETURN FALSE;
    END IF;
    
    -- Get sender wallet
    SELECT id INTO v_sender_wallet_id
    FROM wallets
    WHERE user_id = v_sender_id
    LIMIT 1;
    
    -- Refund sender (this might happen automatically via triggers)
    UPDATE wallets 
    SET available_balance = available_balance + v_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_sender_wallet_id;
    
    -- Log refund
    INSERT INTO ledger_entries (wallet_id, transaction_id, entry_type, amount, balance_after, description)
    SELECT id, p_transaction_id, 'credit', v_amount, available_balance, 'Transfer voided - refund'
    FROM wallets WHERE id = v_sender_wallet_id;
    
    -- Update transaction status
    UPDATE transactions
    SET status = 'failed', updated_at = CURRENT_TIMESTAMP
    WHERE id = p_transaction_id;
    
    -- Log activity
    INSERT INTO user_activities (user_id, activity_type, activity_details)
    VALUES (v_sender_id, 'transfer_voided', 
        jsonb_build_object('amount', v_amount, 'transaction_id', p_transaction_id));
    
    RETURN TRUE;
    
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROCEDURE 4: sp_process_pending_transactions
-- Purpose: Batch settle all eligible pending transactions (uses cursor)
-- Parameters:
--   p_batch_size: Maximum number to process (default 100)
-- Returns: Number of transactions settled
-- ============================================================================
CREATE OR REPLACE FUNCTION sp_process_pending_transactions(p_batch_size INT DEFAULT 100)
RETURNS INT AS $$
DECLARE
    v_transaction_id UUID;
    v_count INT := 0;
    v_tx_cursor CURSOR FOR 
        SELECT id FROM transactions 
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT p_batch_size;
BEGIN
    OPEN v_tx_cursor;
    
    LOOP
        FETCH v_tx_cursor INTO v_transaction_id;
        EXIT WHEN NOT FOUND;
        
        BEGIN
            IF sp_settle_transaction(v_transaction_id) THEN
                v_count := v_count + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue with next transaction
            RAISE WARNING 'Failed to settle transaction %: %', v_transaction_id, SQLERRM;
        END;
    END LOOP;
    
    CLOSE v_tx_cursor;
    RETURN v_count;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROCEDURE 5: sp_update_wallet_balance
-- Purpose: Safely update wallet balance and log to ledger
-- Parameters:
--   p_wallet_id: UUID of wallet
--   p_amount_change: Amount to add/subtract (can be negative)
--   p_description: Reason for update
-- ============================================================================
CREATE OR REPLACE FUNCTION sp_update_wallet_balance(
    p_wallet_id UUID,
    p_amount_change DECIMAL(20, 8),
    p_description VARCHAR(255)
)
RETURNS DECIMAL(20, 8) AS $$
DECLARE
    v_new_balance DECIMAL(20, 8);
    v_entry_type VARCHAR(50);
BEGIN
    -- Prevent zero updates
    IF p_amount_change = 0 THEN
        SELECT available_balance INTO v_new_balance FROM wallets WHERE id = p_wallet_id;
        RETURN v_new_balance;
    END IF;
    
    v_entry_type := CASE WHEN p_amount_change > 0 THEN 'credit' ELSE 'debit' END;
    
    -- Update balance
    UPDATE wallets 
    SET available_balance = available_balance + p_amount_change,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_wallet_id
    RETURNING available_balance INTO v_new_balance;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet % not found', p_wallet_id;
    END IF;
    
    -- Check for negative balance (constraint violation)
    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient balance for wallet %', p_wallet_id;
    END IF;
    
    -- Log to ledger
    INSERT INTO ledger_entries (wallet_id, entry_type, amount, balance_after, description)
    VALUES (p_wallet_id, v_entry_type, ABS(p_amount_change), v_new_balance, p_description);
    
    RETURN v_new_balance;
    
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROCEDURE 6: sp_get_user_wealth_summary
-- Purpose: Calculate total wealth across all user wallets
-- Parameters:
--   p_user_id: UUID of user
-- Returns: TABLE with currency breakdown and total
-- ============================================================================
CREATE OR REPLACE FUNCTION sp_get_user_wealth_summary(p_user_id UUID)
RETURNS TABLE(
    currency_id VARCHAR(50),
    currency_name VARCHAR(255),
    available_balance DECIMAL(20, 8),
    locked_balance DECIMAL(20, 8),
    total_balance DECIMAL(20, 8)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.currency_id,
        c.name,
        w.available_balance,
        w.locked_balance,
        w.available_balance + w.locked_balance as total_balance
    FROM wallets w
    LEFT JOIN currencies c ON w.currency_id = c.id
    WHERE w.user_id = p_user_id
    ORDER BY c.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROCEDURE 7: sp_get_transaction_summary
-- Purpose: Get summary statistics for transactions
-- Parameters:
--   p_user_id: UUID of user (optional, NULL for all)
--   p_start_date: Start date for filtering (optional)
--   p_end_date: End date for filtering (optional)
-- Returns: Transaction statistics
-- ============================================================================
CREATE OR REPLACE FUNCTION sp_get_transaction_summary(
    p_user_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL
)
RETURNS TABLE(
    total_transactions BIGINT,
    total_amount DECIMAL(20, 8),
    settled_count BIGINT,
    pending_count BIGINT,
    failed_count BIGINT,
    avg_amount DECIMAL(20, 8)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END), 0) as settled_count,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed_count,
        COALESCE(AVG(amount), 0) as avg_amount
    FROM transactions
    WHERE (p_user_id IS NULL OR sender_id = p_user_id OR receiver_id = p_user_id)
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROCEDURE 8: sp_lock_wallet_funds
-- Purpose: Lock funds in wallet (used for pending transfers)
-- Parameters:
--   p_wallet_id: UUID of wallet
--   p_amount: Amount to lock
-- Returns: New locked balance
-- ============================================================================
CREATE OR REPLACE FUNCTION sp_lock_wallet_funds(
    p_wallet_id UUID,
    p_amount DECIMAL(20, 8)
)
RETURNS DECIMAL(20, 8) AS $$
DECLARE
    v_available DECIMAL(20, 8);
    v_new_locked DECIMAL(20, 8);
BEGIN
    -- Check available balance
    SELECT available_balance INTO v_available FROM wallets WHERE id = p_wallet_id FOR UPDATE;
    
    IF v_available < p_amount THEN
        RAISE EXCEPTION 'Insufficient available balance. Available: %, Required: %', v_available, p_amount;
    END IF;
    
    -- Deduct from available and add to locked
    UPDATE wallets 
    SET available_balance = available_balance - p_amount,
        locked_balance = locked_balance + p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_wallet_id
    RETURNING locked_balance INTO v_new_locked;
    
    RETURN v_new_locked;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END OF PROCEDURES
-- ============================================================================
