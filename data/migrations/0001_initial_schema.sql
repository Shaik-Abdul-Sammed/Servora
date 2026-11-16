-- ============================================================================
-- Servora Database Schema - Initial Migration (0001)
-- Multi-Tenant QR Restaurant Operating System with Row-Level Security (RLS)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tenancy & Outlets
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    default_locale VARCHAR(10) NOT NULL DEFAULT 'en-US',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outlets_tenant ON outlets(tenant_id);

CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    table_number VARCHAR(50) NOT NULL,
    capacity INT NOT NULL DEFAULT 4,
    qr_code_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(outlet_id, table_number)
);
CREATE INDEX IF NOT EXISTS idx_tables_outlet ON tables(outlet_id);

-- ----------------------------------------------------------------------------
-- 2. Menu Catalog & Modifiers
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_menu_categories_outlet ON menu_categories(outlet_id, sort_order);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    base_price_cents INT NOT NULL CHECK (base_price_cents >= 0),
    image_url TEXT,
    allergens JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_available BOOLEAN NOT NULL DEFAULT TRUE, -- "86" state
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_outlet_avail ON menu_items(outlet_id, is_available);

CREATE TABLE IF NOT EXISTS modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    min_select INT NOT NULL DEFAULT 0,
    max_select INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_modifier_groups_item ON modifier_groups(menu_item_id);

CREATE TABLE IF NOT EXISTS modifier_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price_delta_cents INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON modifier_options(modifier_group_id);

-- ----------------------------------------------------------------------------
-- 3. Orders & Line Items
-- ----------------------------------------------------------------------------

CREATE TYPE order_status_enum AS ENUM (
    'PENDING_PAYMENT',
    'CONFIRMED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'SERVED',
    'CANCELLED'
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
    table_number VARCHAR(50) NOT NULL,
    status order_status_enum NOT NULL DEFAULT 'CONFIRMED',
    subtotal_cents INT NOT NULL CHECK (subtotal_cents >= 0),
    tax_cents INT NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
    tip_cents INT NOT NULL DEFAULT 0 CHECK (tip_cents >= 0),
    total_cents INT NOT NULL CHECK (total_cents >= 0),
    guest_notes TEXT,
    payment_intent_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_outlet_status ON orders(outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    unit_price_cents INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    selected_modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    item_total_cents INT NOT NULL,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ----------------------------------------------------------------------------
-- 4. Multi-Tenant Row-Level Security (RLS)
-- ----------------------------------------------------------------------------

ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_outlets ON outlets
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_tables ON tables
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_categories ON menu_categories
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_items ON menu_items
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_mod_groups ON modifier_groups
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_orders ON orders
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
