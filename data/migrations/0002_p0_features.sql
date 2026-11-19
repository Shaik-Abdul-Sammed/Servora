-- Abiruchi Hotel P0 Operational Achievements Migration
-- Supports 1-tap 86 audit log, category dayparts, outlet shift payment mode, pause surge state, and table call routing

CREATE TABLE IF NOT EXISTS menu_item_audit_logs (
    id TEXT PRIMARY KEY,
    menu_item_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'SOLD_OUT' | 'RESTOCKED'
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outlet_p0_settings (
    outlet_id TEXT PRIMARY KEY,
    payment_mode TEXT NOT NULL DEFAULT 'PAY_LATER', -- 'PAY_FIRST' | 'PAY_LATER'
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    pause_reason TEXT,
    pause_eta_minutes INTEGER DEFAULT 0,
    require_first_order_approval BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS table_assistance_calls (
    id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    table_id TEXT NOT NULL,
    table_number TEXT NOT NULL,
    category TEXT NOT NULL, -- 'WATER' | 'BILL' | 'CUTLERY' | 'MANAGER' | 'SERVER'
    priority TEXT NOT NULL DEFAULT 'NORMAL', -- 'NORMAL' | 'URGENT'
    assigned_staff_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'RESOLVED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);
