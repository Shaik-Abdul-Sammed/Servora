-- ============================================================================
-- Abiruchi Hotel Database Seeds - Demo Restaurant Data (0001)
-- Trattoria Abiruchi Hotel (Downtown Flagship)
-- ============================================================================

-- 1. Tenant
INSERT INTO tenants (id, name, slug, currency, default_locale)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Trattoria Abiruchi Hotel',
    'trattoria-abiruchi',
    'USD',
    'en-US'
) ON CONFLICT (id) DO NOTHING;

-- 2. Outlet
INSERT INTO outlets (id, tenant_id, name, timezone, is_active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Downtown Flagship',
    'America/New_York',
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- 3. Tables
INSERT INTO tables (id, tenant_id, outlet_id, table_number, capacity, qr_code_url, is_active)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'T-01', 2, 'https://order.abiruchi.local/qr?t=1', TRUE),
    ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'T-02', 4, 'https://order.abiruchi.local/qr?t=2', TRUE),
    ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'T-03', 4, 'https://order.abiruchi.local/qr?t=3', TRUE),
    ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'T-04', 6, 'https://order.abiruchi.local/qr?t=4', TRUE),
    ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Bar-01', 1, 'https://order.abiruchi.local/qr?t=5', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. Menu Categories
INSERT INTO menu_categories (id, tenant_id, outlet_id, name, description, sort_order, is_active)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Antipasti & Starters', 'Artisanal bites crafted fresh daily', 1, TRUE),
    ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Wood-Fired Pizzas', 'Naturally fermented sourdough baked at 900°F', 2, TRUE),
    ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Handmade Pastas', 'Extruded bronze-die and hand-rolled pasta', 3, TRUE),
    ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Beverages & Cocktails', 'Aperitifs, craft sodas, and Italian wines', 4, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5. Menu Items
INSERT INTO menu_items (id, tenant_id, outlet_id, category_id, name, description, base_price_cents, allergens, is_available)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
     'Truffle Burrata Pugliese', 'Creamy pugliese burrata, black truffle carpaccio, heirloom cherry tomatoes, basil emulsion', 1850, '["dairy"]'::jsonb, TRUE),

    ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
     'Margherita Verace D.O.P.', 'San Marzano tomatoes, Fior di Latte mozzarella, fresh sweet basil, extra virgin olive oil', 1900, '["gluten", "dairy"]'::jsonb, TRUE),

    ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
     'Diavola Piccante', 'Spicy Calabrian soppressata, chili-infused hot honey, smoked provolone, fresh oregano', 2250, '["gluten", "dairy", "pork"]'::jsonb, TRUE),

    ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003',
     'Tagliatelle al Ragù Bolognese', 'Slow-braised heritage beef and veal ragù, parmigiano reggiano aged 24 months', 2400, '["gluten", "dairy", "egg"]'::jsonb, TRUE),

    ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
     'Sicilian Blood Orange Spritz', 'Solerno blood orange liqueur, prosecco superiore, club soda, rosemary sprig', 1400, '[]'::jsonb, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 6. Modifiers
INSERT INTO modifier_groups (id, tenant_id, menu_item_id, name, min_select, max_select)
VALUES
    ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Crust Preference', 1, 1),
    ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Extra Toppings', 0, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO modifier_options (id, modifier_group_id, name, price_delta_cents, is_default)
VALUES
    ('g0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Classic Neapolitan Sourdough', 0, TRUE),
    ('g0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Gluten-Free Artisan Crust', 350, FALSE),
    ('g0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', 'Buffalo Mozzarella (+)', 400, FALSE),
    ('g0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', 'Calabrian Chili Oil (+)', 150, FALSE)
ON CONFLICT (id) DO NOTHING;
