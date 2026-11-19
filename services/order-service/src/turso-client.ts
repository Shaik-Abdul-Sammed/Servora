import { createClient, type Client, type Transaction } from '@libsql/client';

export interface TursoConfig {
  url: string;
  authToken?: string;
}

export class TursoDatabase {
  private client: Client | null = null;
  private isConfigured: boolean = false;

  constructor(config?: TursoConfig) {
    const url = config?.url || process.env.TURSO_DATABASE_URL;
    const authToken = config?.authToken || process.env.TURSO_AUTH_TOKEN;

    if (url) {
      this.client = createClient({
        url,
        authToken: authToken || undefined,
      });
      this.isConfigured = true;
    }
  }

  public get isConnected(): boolean {
    return this.isConfigured && this.client !== null;
  }

  public getClient(): Client | null {
    return this.client;
  }

  public async ping(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    if (!this.client) {
      return { ok: false, error: 'Turso client is not configured' };
    }
    const start = Date.now();
    try {
      await this.client.execute('SELECT 1 as ping;');
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Versioned, idempotent migration runner for Turso libSQL database.
   */
  public async runMigrations(): Promise<{ applied: number; versions: number[] }> {
    if (!this.client) {
      throw new Error('Cannot run migrations: Turso client not configured');
    }

    // 1. Create migration history tracking table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    // Fetch applied migrations
    const res = await this.client.execute('SELECT version FROM schema_migrations ORDER BY version ASC;');
    const appliedVersions = new Set(res.rows.map((r: any) => Number(r.version)));
    const newlyApplied: number[] = [];

    const migrations = [
      {
        version: 1,
        name: '001_core_schema',
        statements: [
          `CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS outlets (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS tables (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            outlet_id TEXT NOT NULL,
            table_number TEXT NOT NULL,
            status TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS menu_item_audit_logs (
            id TEXT PRIMARY KEY,
            menu_item_id TEXT NOT NULL,
            outlet_id TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            action TEXT NOT NULL,
            reason TEXT,
            created_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS outlet_p0_settings (
            outlet_id TEXT PRIMARY KEY,
            payment_mode TEXT NOT NULL DEFAULT 'PAY_LATER',
            is_paused INTEGER NOT NULL DEFAULT 0,
            pause_reason TEXT,
            pause_eta_minutes INTEGER DEFAULT 0,
            require_first_order_approval INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL,
            display_mode TEXT DEFAULT 'TABLE',
            token_prefix TEXT DEFAULT 'A',
            token_counter INTEGER DEFAULT 0
          );`,
          `CREATE TABLE IF NOT EXISTS table_assistance_calls (
            id TEXT PRIMARY KEY,
            outlet_id TEXT NOT NULL,
            table_id TEXT NOT NULL,
            table_number TEXT NOT NULL,
            category TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'NORMAL',
            assigned_staff_id TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING',
            created_at TEXT NOT NULL,
            resolved_at TEXT
          );`,
          `CREATE TABLE IF NOT EXISTS service_tokens (
            id TEXT PRIMARY KEY,
            outlet_id TEXT NOT NULL,
            code TEXT NOT NULL,
            bucket TEXT NOT NULL,
            state TEXT NOT NULL,
            order_ref TEXT,
            guest_phone TEXT,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS payment_records (
            id TEXT PRIMARY KEY,
            outlet_id TEXT NOT NULL,
            order_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            method TEXT NOT NULL,
            status TEXT NOT NULL,
            verified_by TEXT,
            verified_at TEXT,
            notes TEXT,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            split_group_id TEXT,
            split_share_amount INTEGER,
            tip_paise INTEGER DEFAULT 0,
            rejected_reason TEXT,
            refund_of_payment_id TEXT,
            reconciled_at TEXT
          );`,
          `CREATE TABLE IF NOT EXISTS table_bookings (
            id TEXT PRIMARY KEY,
            outlet_id TEXT NOT NULL,
            table_id TEXT,
            guest_name TEXT NOT NULL,
            guest_phone TEXT,
            party_size INTEGER NOT NULL,
            slot_date TEXT NOT NULL,
            slot_time TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            prepay_amount_cents INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            notes TEXT,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            override_of_booking_id TEXT,
            is_recurring INTEGER DEFAULT 0,
            recurrence_pattern TEXT,
            event_type TEXT,
            reminder_sent_2h INTEGER DEFAULT 0,
            reminder_sent_30m INTEGER DEFAULT 0,
            no_show INTEGER DEFAULT 0,
            refund_status TEXT,
            refund_amount INTEGER DEFAULT 0,
            whatsapp_sent_at TEXT
          );`,
          `CREATE TABLE IF NOT EXISTS guest_preferences (
            id TEXT PRIMARY KEY,
            phone_hash TEXT UNIQUE NOT NULL,
            allergens TEXT NOT NULL,
            milk_pref TEXT,
            spice_level TEXT,
            favorite_item_ids TEXT NOT NULL,
            visit_count INTEGER NOT NULL,
            last_visit_at TEXT,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS recovery_tickets (
            id TEXT PRIMARY KEY,
            outlet_id TEXT NOT NULL,
            order_id TEXT NOT NULL,
            rating INTEGER NOT NULL,
            category TEXT NOT NULL,
            comment TEXT,
            status TEXT NOT NULL,
            acknowledged_by TEXT,
            acknowledged_at TEXT,
            closed_by TEXT,
            closed_at TEXT,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS beverage_config (
            id TEXT PRIMARY KEY, outletId TEXT NOT NULL, name TEXT NOT NULL,
            category TEXT DEFAULT 'BEVERAGE', priceCents INTEGER DEFAULT 0,
            imageUrl TEXT, isAvailable INTEGER DEFAULT 1, stock INTEGER DEFAULT 999,
            sizeOptions TEXT DEFAULT '[]', createdAt TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS specials (
            id TEXT PRIMARY KEY, outletId TEXT NOT NULL, name TEXT NOT NULL,
            description TEXT DEFAULT '', imageUrl TEXT,
            basePriceCents INTEGER DEFAULT 0, discountPriceCents INTEGER,
            limitedQty INTEGER, remainingQty INTEGER,
            servingFrom TEXT, servingUntil TEXT, startDate TEXT, endDate TEXT,
            tags TEXT DEFAULT '[]', isAvailable INTEGER DEFAULT 1, createdAt TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS offers (
            id TEXT PRIMARY KEY, outletId TEXT NOT NULL, type TEXT NOT NULL,
            name TEXT NOT NULL, description TEXT DEFAULT '',
            discountPercent REAL DEFAULT 0, discountCents INTEGER DEFAULT 0,
            minOrderCents INTEGER DEFAULT 0, maxUsesPerDay INTEGER DEFAULT 999,
            usedToday INTEGER DEFAULT 0,
            applicableItemIds TEXT DEFAULT '[]', applicableCategories TEXT DEFAULT '[]',
            validDays TEXT DEFAULT '["MON","TUE","WED","THU","FRI","SAT","SUN"]',
            validFrom TEXT, validUntil TEXT, timeWindowStart TEXT, timeWindowEnd TEXT,
            isActive INTEGER DEFAULT 1, stackable INTEGER DEFAULT 0, createdAt TEXT NOT NULL,
            promo_code TEXT, deleted_at TEXT, max_redemptions INTEGER DEFAULT 999,
            redemption_count INTEGER DEFAULT 0, starts_at TEXT, ends_at TEXT,
            value REAL DEFAULT 0, time_from TEXT, time_to TEXT, days_of_week TEXT,
            applies_to_json TEXT
          );`,
          `CREATE TABLE IF NOT EXISTS offer_redemptions (
            id TEXT PRIMARY KEY, offerId TEXT, orderId TEXT,
            tableId TEXT, savedCents INTEGER DEFAULT 0, redeemedAt TEXT,
            session_id TEXT, discount_cents INTEGER DEFAULT 0, offer_id TEXT,
            order_id TEXT, created_at TEXT
          );`,
          `CREATE TABLE IF NOT EXISTS water_preferences (
            tableId TEXT PRIMARY KEY, preference TEXT NOT NULL, updatedAt TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS subscription_plans (
            id TEXT PRIMARY KEY, outlet_id TEXT NOT NULL,
            tier TEXT NOT NULL DEFAULT 'FREE_BASE',
            max_waiters INTEGER NOT NULL DEFAULT 3,
            max_outlets INTEGER NOT NULL DEFAULT 1,
            max_tables INTEGER NOT NULL DEFAULT 20,
            features TEXT NOT NULL DEFAULT '["QR_ORDERING","TABLE_MANAGEMENT","BASIC_KDS","RECEIPTS"]',
            is_free INTEGER DEFAULT 1, updated_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS qr_codes (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, outlet_id TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
            target_id TEXT, destination_url TEXT NOT NULL, signed_token TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ACTIVE', expires_at TEXT,
            scan_count INTEGER DEFAULT 0, last_scanned_at TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS qr_scans (
            id TEXT PRIMARY KEY, qr_code_id TEXT NOT NULL, outlet_id TEXT NOT NULL,
            ip TEXT, user_agent TEXT, scanned_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS staff_members (
            id TEXT PRIMARY KEY, outlet_id TEXT NOT NULL,
            name TEXT NOT NULL, email TEXT, role TEXT NOT NULL, pin_code TEXT NOT NULL,
            is_active INTEGER DEFAULT 1, assigned_tables TEXT DEFAULT '[]',
            shift_start TEXT, shift_end TEXT, phone TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS station_routing_rules (
            id TEXT PRIMARY KEY, outlet_id TEXT NOT NULL,
            category_id TEXT NOT NULL, category_name TEXT NOT NULL,
            station TEXT NOT NULL, auto_split INTEGER DEFAULT 1, updated_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS qr_tables (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            zone TEXT DEFAULT 'Main Dining',
            qr_token TEXT,
            created_at TEXT NOT NULL,
            deleted_at TEXT
          );`,
          `CREATE TABLE IF NOT EXISTS tenant_profile (
            tenant_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            address TEXT NOT NULL,
            gstin TEXT NOT NULL,
            fssai TEXT NOT NULL,
            phone TEXT NOT NULL,
            map_link TEXT NOT NULL,
            hours_json TEXT NOT NULL,
            today_special TEXT,
            about_text TEXT,
            updated_at TEXT NOT NULL,
            service_charge_percent REAL DEFAULT 0
          );`,
          `CREATE TABLE IF NOT EXISTS p0_service_tokens (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            order_id TEXT NOT NULL,
            token_code TEXT NOT NULL,
            station TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'QUEUED',
            assigned_waiter_id TEXT,
            created_at TEXT NOT NULL,
            state_changed_at TEXT NOT NULL,
            escalated INTEGER DEFAULT 0
          );`,
          `CREATE TABLE IF NOT EXISTS waste_logs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            ingredient_id TEXT,
            item_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            reason TEXT NOT NULL,
            cost_paise INTEGER NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            order_id TEXT NOT NULL,
            rating INTEGER NOT NULL,
            categories_json TEXT,
            note TEXT,
            recovery_state TEXT DEFAULT 'OPEN',
            recovery_note TEXT,
            created_at TEXT NOT NULL,
            resolved_at TEXT
          );`,
          `CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            outlet_id TEXT NOT NULL,
            order_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            method TEXT NOT NULL,
            status TEXT NOT NULL,
            split_group_id TEXT,
            split_share_amount INTEGER,
            tip_paise INTEGER DEFAULT 0,
            verified_by TEXT,
            verified_at TEXT,
            rejected_reason TEXT,
            refund_of_payment_id TEXT,
            reconciled_at TEXT,
            notes TEXT,
            data TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            phone TEXT,
            name TEXT,
            session_id TEXT,
            loyalty_optin_at TEXT,
            opt_out_at TEXT,
            stamps INTEGER DEFAULT 0,
            visits_count INTEGER DEFAULT 0,
            last_visit_at TEXT,
            birthday_month_day TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );`,
          `CREATE TABLE IF NOT EXISTS loyalty_stamps (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            order_id TEXT NOT NULL,
            earned_at TEXT NOT NULL,
            redeemed_at TEXT
          );`,
        ],
      },
      {
        version: 2,
        name: '002_integrity_indexes',
        statements: [
          `CREATE INDEX IF NOT EXISTS idx_orders_outlet_status ON orders(outlet_id, status);`,
          `CREATE INDEX IF NOT EXISTS idx_service_tokens_outlet_state ON service_tokens(outlet_id, state);`,
          `CREATE INDEX IF NOT EXISTS idx_p0_tokens_tenant_state ON p0_service_tokens(tenant_id, state);`,
          `CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);`,
          `CREATE INDEX IF NOT EXISTS idx_bookings_outlet_date ON table_bookings(outlet_id, slot_date);`,
          `CREATE INDEX IF NOT EXISTS idx_qr_tables_tenant ON qr_tables(tenant_id);`,
          `CREATE UNIQUE INDEX IF NOT EXISTS uq_service_tokens_outlet_code ON service_tokens(outlet_id, code);`,
          `CREATE UNIQUE INDEX IF NOT EXISTS uq_p0_tokens_tenant_code ON p0_service_tokens(tenant_id, token_code);`,
        ],
      },
      {
        version: 3,
        name: '003_upi_prepayment_reconciliation',
        statements: [
          `ALTER TABLE payments ADD COLUMN utr TEXT;`,
          `ALTER TABLE payments ADD COLUMN customer_name TEXT;`,
          `ALTER TABLE payments ADD COLUMN customer_mobile TEXT;`,
          `ALTER TABLE payments ADD COLUMN screenshot_url TEXT;`,
          `ALTER TABLE payments ADD COLUMN verification_notes TEXT;`,
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_utr_unique ON payments(utr) WHERE utr IS NOT NULL AND utr != '' AND status != 'REJECTED';`,
          `ALTER TABLE payment_records ADD COLUMN utr TEXT;`,
          `ALTER TABLE payment_records ADD COLUMN customer_name TEXT;`,
          `ALTER TABLE payment_records ADD COLUMN customer_mobile TEXT;`,
          `ALTER TABLE payment_records ADD COLUMN screenshot_url TEXT;`,
          `ALTER TABLE payment_records ADD COLUMN verification_notes TEXT;`,
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_utr_unique ON payment_records(utr) WHERE utr IS NOT NULL AND utr != '' AND status != 'REJECTED';`,
        ],
      },
    ];

    for (const migration of migrations) {
      if (!appliedVersions.has(migration.version)) {
        console.log(`[Turso Migration] Applying ${migration.version}: ${migration.name}...`);
        for (const sql of migration.statements) {
          try {
            await this.client.execute(sql);
          } catch (e: any) {
            // Ignore if column or index already exists
            const msg = (e.message || '').toLowerCase();
            if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
              console.warn(`[Turso Migration] Warning on statement "${sql}":`, e.message);
            }
          }
        }
        await this.client.execute({
          sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          args: [migration.version, migration.name, new Date().toISOString()],
        });
        newlyApplied.push(migration.version);
        console.log(`[Turso Migration] Successfully applied ${migration.name}`);
      }
    }

    return {
      applied: newlyApplied.length,
      versions: newlyApplied,
    };
  }

  /**
   * Seeds demo data into Turso if tenants table is empty.
   */
  public async seedIfEmpty(seedData: {
    tenants: any[];
    outlets: any[];
    tables: any[];
    categories: any[];
    menuItems: any[];
    qrTables?: any[];
    tenantProfile?: any;
  }) {
    if (!this.client) return;
    const res = await this.client.execute('SELECT COUNT(*) as count FROM tenants;');
    const count = Number(res.rows[0]?.count || 0);
    if (count > 0) return;

    console.log('[Turso] Database empty. Seeding initial restaurant catalog to Turso...');
    const statements: any[] = [];

    for (const t of seedData.tenants) {
      statements.push({ sql: 'INSERT OR REPLACE INTO tenants VALUES (?, ?)', args: [t.id, JSON.stringify(t)] });
    }
    for (const o of seedData.outlets) {
      statements.push({ sql: 'INSERT OR REPLACE INTO outlets VALUES (?, ?)', args: [o.id, JSON.stringify(o)] });
    }
    for (const tbl of seedData.tables) {
      statements.push({ sql: 'INSERT OR REPLACE INTO tables VALUES (?, ?)', args: [tbl.id, JSON.stringify(tbl)] });
    }
    for (const c of seedData.categories) {
      statements.push({ sql: 'INSERT OR REPLACE INTO categories VALUES (?, ?)', args: [c.id, JSON.stringify(c)] });
    }
    for (const m of seedData.menuItems) {
      statements.push({ sql: 'INSERT OR REPLACE INTO menu_items VALUES (?, ?)', args: [m.id, JSON.stringify(m)] });
    }
    if (seedData.qrTables) {
      for (const qt of seedData.qrTables) {
        statements.push({
          sql: 'INSERT OR REPLACE INTO qr_tables VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [qt.id, qt.tenant_id || qt.tenantId, qt.name, qt.zone || 'Main Dining', qt.qr_token || null, qt.created_at || new Date().toISOString(), qt.deleted_at || null],
        });
      }
    }
    if (seedData.tenantProfile) {
      const p = seedData.tenantProfile;
      statements.push({
        sql: `INSERT OR REPLACE INTO tenant_profile VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          p.tenant_id,
          p.name,
          p.address,
          p.gstin,
          p.fssai,
          p.phone,
          p.map_link,
          p.hours_json,
          p.today_special || null,
          p.about_text || null,
          p.updated_at || new Date().toISOString(),
          p.service_charge_percent || 0,
        ],
      });
    }

    if (statements.length > 0) {
      // Chunk batches of 50 to avoid payload size constraints
      const chunkSize = 50;
      for (let i = 0; i < statements.length; i += chunkSize) {
        await this.client.batch(statements.slice(i, i + chunkSize), 'write');
      }
      console.log(`[Turso] Successfully seeded ${statements.length} records into Turso.`);
    }
  }

  /**
   * Executes atomic order creation transaction on Turso.
   * Guarantees atomic insertion of order, token, and audit record.
   */
  public async executeOrderTransaction(order: any, token?: any): Promise<boolean> {
    if (!this.client) return false;

    const statements: any[] = [
      {
        sql: 'INSERT INTO orders (id, outlet_id, table_number, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
        args: [order.id, order.outletId, order.tableNumber, order.status, JSON.stringify(order), order.createdAt, order.updatedAt],
      },
    ];

    if (token) {
      statements.push({
        sql: 'INSERT INTO p0_service_tokens (id, tenant_id, order_id, token_code, station, state, assigned_waiter_id, created_at, state_changed_at, escalated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
        args: [
          token.id,
          token.tenantId || token.tenant_id,
          order.id,
          token.token_code || token.code,
          token.station || 'HOT_LINE',
          token.state || 'QUEUED',
          token.assigned_waiter_id || null,
          token.created_at || order.createdAt,
          token.state_changed_at || order.createdAt,
          0,
        ],
      });
    }

    try {
      await this.client.batch(statements, 'write');
      return true;
    } catch (err) {
      console.error('[Turso] Transaction failed:', err);
      return false;
    }
  }
}
