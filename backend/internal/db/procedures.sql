
















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
    
    IF p_sender_id = p_receiver_id THEN
        RAISE EXCEPTION 'Cannot transfer to same user';
    END IF;
    
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be positive';
    END IF;
    
    
    IF NOT EXISTS (SELECT 1 FROM currencies WHERE id = p_currency_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Currency % does not exist or is inactive', p_currency_id;
    END IF;
    
    
    SELECT id INTO v_sender_wallet_id 
    FROM wallets 
    WHERE user_id = p_sender_id AND currency_id = p_currency_id;
    
    IF v_sender_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Sender does not have a wallet in currency %', p_currency_id;
    END IF;
    
    
    SELECT available_balance INTO v_sender_balance 
    FROM wallets 
    WHERE id = v_sender_wallet_id 
    FOR UPDATE;
    
    IF v_sender_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Available: %, Required: %', v_sender_balance, p_amount;
    END IF;
    
    
    SELECT id INTO v_receiver_wallet_id 
    FROM wallets 
    WHERE user_id = p_receiver_id AND currency_id = p_currency_id;
    
    IF v_receiver_wallet_id IS NULL THEN
        
        INSERT INTO wallets (user_id, currency_id, available_balance, locked_balance, created_at, updated_at)
        VALUES (p_receiver_id, p_currency_id, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id INTO v_receiver_wallet_id;
    END IF;
    
    
    INSERT INTO transactions (
        sender_id, receiver_id, amount, status, 
        origin_planet, destination_planet, 
        created_at, updated_at
    ) VALUES (
        p_sender_id, p_receiver_id, p_amount, 'pending',
        p_origin_planet, p_destination_planet,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) RETURNING id INTO v_transaction_id;
    
    
    UPDATE wallets 
    SET available_balance = available_balance - p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_sender_wallet_id;
    
    
    INSERT INTO ledger_entries (wallet_id, transaction_id, entry_type, amount, balance_after, description)
    SELECT id, v_transaction_id, 'debit', p_amount, available_balance, 'Transfer sent'
    FROM wallets WHERE id = v_sender_wallet_id;
    
    
    INSERT INTO user_activities (user_id, activity_type, activity_details)
    VALUES (p_sender_id, 'transfer_initiated', 
        jsonb_build_object('amount', p_amount, 'currency', p_currency_id, 'transaction_id', v_transaction_id));
    
    RETURN v_transaction_id;
    
EXCEPTION WHEN OTHERS THEN
    
    INSERT INTO user_activities (user_id, activity_type, activity_details)
    VALUES (p_sender_id, 'transfer_failed', 
        jsonb_build_object('error', SQLERRM, 'amount', p_amount, 'currency', p_currency_id));
    RAISE;
END;
$$ LANGUAGE plpgsql;








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
    
    SELECT sender_id, receiver_id, amount, status INTO v_sender_id, v_receiver_id, v_amount, v_status
    FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
    END IF;
    
    
    IF v_status != 'pending' THEN
        RETURN FALSE;
    END IF;
    
    
    SELECT w.id, w.currency_id INTO v_receiver_wallet_id, v_currency_id
    FROM wallets w
    WHERE w.user_id = v_receiver_id
    LIMIT 1;
    
    IF v_receiver_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Receiver wallet not found';
    END IF;
    
    
    UPDATE wallets 
    SET available_balance = available_balance + v_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_receiver_wallet_id;
    
    
    INSERT INTO ledger_entries (wallet_id, transaction_id, entry_type, amount, balance_after, description)
    SELECT id, p_transaction_id, 'credit', v_amount, available_balance, 'Transfer received'
    FROM wallets WHERE id = v_receiver_wallet_id;
    
    
    UPDATE transactions
    SET status = 'settled', updated_at = CURRENT_TIMESTAMP
    WHERE id = p_transaction_id;
    
    
    INSERT INTO user_activities (user_id, activity_type, activity_details)
    VALUES (v_receiver_id, 'transfer_received', 
        jsonb_build_object('amount', v_amount, 'transaction_id', p_transaction_id));
    
    RETURN TRUE;
    
EXCEPTION WHEN OTHERS THEN
    
    UPDATE transactions SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = p_transaction_id;
    RAISE;
END;
$$ LANGUAGE plpgsql;








CREATE OR REPLACE FUNCTION sp_void_transaction(p_transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_sender_id UUID;
    v_amount DECIMAL(20, 8);
    v_status VARCHAR(50);
    v_sender_wallet_id UUID;
BEGIN
    
    SELECT sender_id, amount, status INTO v_sender_id, v_amount, v_status
    FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
    END IF;
    
    
    IF v_status != 'pending' THEN
        RETURN FALSE;
    END IF;
    
    
    SELECT id INTO v_sender_wallet_id
    FROM wallets
    WHERE user_id = v_sender_id
    LIMIT 1;
    
    
    UPDATE wallets 
    SET available_balance = available_balance + v_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_sender_wallet_id;
    
    
    INSERT INTO ledger_entries (wallet_id, transaction_id, entry_type, amount, balance_after, description)
    SELECT id, p_transaction_id, 'credit', v_amount, available_balance, 'Transfer voided - refund'
    FROM wallets WHERE id = v_sender_wallet_id;
    
    
    UPDATE transactions
    SET status = 'failed', updated_at = CURRENT_TIMESTAMP
    WHERE id = p_transaction_id;
    
    
    INSERT INTO user_activities (user_id, activity_type, activity_details)
    VALUES (v_sender_id, 'transfer_voided', 
        jsonb_build_object('amount', v_amount, 'transaction_id', p_transaction_id));
    
    RETURN TRUE;
    
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql;








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
            
            RAISE WARNING 'Failed to settle transaction %: %', v_transaction_id, SQLERRM;
        END;
    END LOOP;
    
    CLOSE v_tx_cursor;
    RETURN v_count;
    
END;
$$ LANGUAGE plpgsql;









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
    
    IF p_amount_change = 0 THEN
        SELECT available_balance INTO v_new_balance FROM wallets WHERE id = p_wallet_id;
        RETURN v_new_balance;
    END IF;
    
    v_entry_type := CASE WHEN p_amount_change > 0 THEN 'credit' ELSE 'debit' END;
    
    
    UPDATE wallets 
    SET available_balance = available_balance + p_amount_change,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_wallet_id
    RETURNING available_balance INTO v_new_balance;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet % not found', p_wallet_id;
    END IF;
    
    
    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient balance for wallet %', p_wallet_id;
    END IF;
    
    
    INSERT INTO ledger_entries (wallet_id, entry_type, amount, balance_after, description)
    VALUES (p_wallet_id, v_entry_type, ABS(p_amount_change), v_new_balance, p_description);
    
    RETURN v_new_balance;
    
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql;








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









CREATE OR REPLACE FUNCTION sp_lock_wallet_funds(
    p_wallet_id UUID,
    p_amount DECIMAL(20, 8)
)
RETURNS DECIMAL(20, 8) AS $$
DECLARE
    v_available DECIMAL(20, 8);
    v_new_locked DECIMAL(20, 8);
BEGIN
    
    SELECT available_balance INTO v_available FROM wallets WHERE id = p_wallet_id FOR UPDATE;
    
    IF v_available < p_amount THEN
        RAISE EXCEPTION 'Insufficient available balance. Available: %, Required: %', v_available, p_amount;
    END IF;
    
    
    UPDATE wallets 
    SET available_balance = available_balance - p_amount,
        locked_balance = locked_balance + p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_wallet_id
    RETURNING locked_balance INTO v_new_locked;
    
    RETURN v_new_locked;
END;
$$ LANGUAGE plpgsql;




