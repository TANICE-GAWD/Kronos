


CREATE EXTENSION IF NOT EXISTS "uuid-ossp";




CREATE TABLE IF NOT EXISTS currencies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    planet_name VARCHAR(100) NOT NULL UNIQUE,
    symbol VARCHAR(10) NOT NULL,
    decimals INT NOT NULL DEFAULT 8 CHECK (decimals >= 0 AND decimals <= 18),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS transaction_statuses (
    id SERIAL PRIMARY KEY,
    status_code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    home_planet VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);


CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency_id VARCHAR(50) NOT NULL REFERENCES currencies(id),
    available_balance DECIMAL(20, 8) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    locked_balance DECIMAL(20, 8) NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, currency_id)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_currency_id ON wallets(currency_id);
CREATE INDEX IF NOT EXISTS idx_wallets_balance ON wallets(available_balance);


CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(20, 8) NOT NULL CHECK (amount > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'failed')),
    origin_planet VARCHAR(100) NOT NULL,
    destination_planet VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_sender_id ON transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_id ON transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at DESC);


CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    amount DECIMAL(20, 8) NOT NULL CHECK (amount >= 0),
    balance_after DECIMAL(20, 8) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_wallet_id ON ledger_entries(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON ledger_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_wallet_date ON ledger_entries(wallet_id, created_at DESC);


CREATE TABLE IF NOT EXISTS transaction_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(100) DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_transaction_history_tx_id ON transaction_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_history_changed_at ON transaction_history(changed_at DESC);


CREATE TABLE IF NOT EXISTS user_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    activity_details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);


CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';


CREATE OR REPLACE FUNCTION log_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status THEN
        INSERT INTO transaction_history (transaction_id, old_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';


CREATE OR REPLACE FUNCTION log_wallet_balance_change()
RETURNS TRIGGER AS $$
DECLARE
    v_balance_change DECIMAL(20, 8);
    v_entry_type VARCHAR(50);
BEGIN
    
    IF NEW.available_balance != OLD.available_balance THEN
        v_balance_change := NEW.available_balance - OLD.available_balance;
        v_entry_type := CASE WHEN v_balance_change > 0 THEN 'credit' ELSE 'debit' END;
        
        INSERT INTO ledger_entries (wallet_id, entry_type, amount, balance_after, description)
        VALUES (
            NEW.id,
            v_entry_type,
            ABS(v_balance_change),
            NEW.available_balance,
            'Balance update via trigger'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at 
    BEFORE UPDATE ON wallets 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


DROP TRIGGER IF EXISTS log_transaction_status ON transactions;
CREATE TRIGGER log_transaction_status 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW EXECUTE PROCEDURE log_transaction_status_change();

DROP TRIGGER IF EXISTS log_wallet_changes ON wallets;
CREATE TRIGGER log_wallet_changes 
    AFTER UPDATE ON wallets 
    FOR EACH ROW EXECUTE PROCEDURE log_wallet_balance_change();




INSERT INTO transaction_statuses (status_code, description) VALUES 
    ('pending', 'Transaction waiting to be settled'),
    ('settled', 'Transaction successfully completed'),
    ('failed', 'Transaction failed or was voided')
ON CONFLICT (status_code) DO NOTHING;


INSERT INTO currencies (id, name, planet_name, symbol, decimals) VALUES
    ('EARTH', 'Earth Credits', 'Earth', 'EC', 8),
    ('MARS', 'Mars Tokens', 'Mars', 'MT', 8),
    ('VENUS', 'Venus Drachma', 'Venus', 'VD', 8),
    ('JUPITER', 'Jupiter Juno', 'Jupiter', 'JJ', 8),
    ('SATURN', 'Saturn Saturn', 'Saturn', 'SS', 8),
    ('MERCURY', 'Mercury Mark', 'Mercury', 'MM', 8),
    ('MOON', 'Lunar Lunes', 'Moon', 'LL', 8),
    ('ASTEROID', 'Asteroid Credits', 'Asteroid Belt', 'AC', 8)
ON CONFLICT (id) DO NOTHING;



CREATE TABLE IF NOT EXISTS schema_versions (
    version_id INT PRIMARY KEY,
    version_name VARCHAR(100) NOT NULL,
    description TEXT,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO schema_versions (version_id, version_name, description)
VALUES (1, 'Enhanced-DBMS-V1', 'Added ledger, transaction history, currencies, and audit tables')
ON CONFLICT DO NOTHING;

 
