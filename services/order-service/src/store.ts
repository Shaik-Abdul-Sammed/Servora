import type {
  Tenant,
  Outlet,
  Table,
  MenuCategory,
  MenuItem,
  Order,
  OrderStatus,
} from '../../../packages/shared-types/src/index.ts';

export class OrderStore {
  public tenants = new Map<string, Tenant>();
  public outlets = new Map<string, Outlet>();
  public tables = new Map<string, Table>();
  public categories = new Map<string, MenuCategory>();
  public menuItems = new Map<string, MenuItem>();
  public orders = new Map<string, Order>();

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData() {
    const tenantId = 'a0000000-0000-0000-0000-000000000001';
    const outletId = 'b0000000-0000-0000-0000-000000000001';

    // 1. Tenant
    this.tenants.set(tenantId, {
      id: tenantId,
      name: 'Trattoria Servora',
      slug: 'trattoria-servora',
      currency: 'USD',
      defaultLocale: 'en-US',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Outlet
    this.outlets.set(outletId, {
      id: outletId,
      tenantId,
      name: 'Downtown Flagship',
      timezone: 'America/New_York',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. Tables
    const tableData: Array<{ id: string; num: string; cap: number }> = [
      { id: 'c0000000-0000-0000-0000-000000000001', num: 'T-01', cap: 2 },
      { id: 'c0000000-0000-0000-0000-000000000002', num: 'T-02', cap: 4 },
      { id: 'c0000000-0000-0000-0000-000000000003', num: 'T-03', cap: 4 },
      { id: 'c0000000-0000-0000-0000-000000000004', num: 'T-04', cap: 6 },
      { id: 'c0000000-0000-0000-0000-000000000005', num: 'Bar-01', cap: 1 },
    ];
    for (const t of tableData) {
      this.tables.set(t.id, {
        id: t.id,
        tenantId,
        outletId,
        tableNumber: t.num,
        capacity: t.cap,
        qrCodeUrl: `/qr?tableId=${t.id}`,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 4. Categories
    const cat1 = 'd0000000-0000-0000-0000-000000000001';
    const cat2 = 'd0000000-0000-0000-0000-000000000002';
    const cat3 = 'd0000000-0000-0000-0000-000000000003';
    const cat4 = 'd0000000-0000-0000-0000-000000000004';

    this.categories.set(cat1, {
      id: cat1,
      tenantId,
      outletId,
      name: 'Antipasti & Starters',
      description: 'Artisanal bites crafted fresh daily',
      sortOrder: 1,
      isActive: true,
    });
    this.categories.set(cat2, {
      id: cat2,
      tenantId,
      outletId,
      name: 'Wood-Fired Pizzas',
      description: 'Naturally fermented sourdough baked at 900°F',
      sortOrder: 2,
      isActive: true,
    });
    this.categories.set(cat3, {
      id: cat3,
      tenantId,
      outletId,
      name: 'Handmade Pastas',
      description: 'Extruded bronze-die and hand-rolled pasta',
      sortOrder: 3,
      isActive: true,
    });
    this.categories.set(cat4, {
      id: cat4,
      tenantId,
      outletId,
      name: 'Beverages & Cocktails',
      description: 'Aperitifs, craft sodas, and Italian wines',
      sortOrder: 4,
      isActive: true,
    });

    // 5. Menu Items
    this.menuItems.set('e0000000-0000-0000-0000-000000000001', {
      id: 'e0000000-0000-0000-0000-000000000001',
      tenantId,
      outletId,
      categoryId: cat1,
      name: 'Truffle Burrata Pugliese',
      description: 'Creamy pugliese burrata, black truffle carpaccio, heirloom cherry tomatoes, basil emulsion',
      basePriceCents: 1850,
      imageUrl: 'https://images.unsplash.com/photo-1592417817098-8f3d6910985b?auto=format&fit=crop&w=600&q=80',
      allergens: ['dairy'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.menuItems.set('e0000000-0000-0000-0000-000000000002', {
      id: 'e0000000-0000-0000-0000-000000000002',
      tenantId,
      outletId,
      categoryId: cat2,
      name: 'Margherita Verace D.O.P.',
      description: 'San Marzano tomatoes, Fior di Latte mozzarella, fresh sweet basil, extra virgin olive oil',
      basePriceCents: 1900,
      imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80',
      allergens: ['gluten', 'dairy'],
      isAvailable: true,
      modifierGroups: [
        {
          id: 'f0000000-0000-0000-0000-000000000001',
          name: 'Crust Preference',
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: 'g0000000-0000-0000-0000-000000000001', name: 'Classic Neapolitan Sourdough', priceDeltaCents: 0, isDefault: true },
            { id: 'g0000000-0000-0000-0000-000000000002', name: 'Gluten-Free Artisan Crust', priceDeltaCents: 350, isDefault: false },
          ],
        },
        {
          id: 'f0000000-0000-0000-0000-000000000002',
          name: 'Extra Toppings',
          minSelect: 0,
          maxSelect: 3,
          options: [
            { id: 'g0000000-0000-0000-0000-000000000003', name: 'Buffalo Mozzarella (+)', priceDeltaCents: 400, isDefault: false },
            { id: 'g0000000-0000-0000-0000-000000000004', name: 'Calabrian Chili Oil (+)', priceDeltaCents: 150, isDefault: false },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.menuItems.set('e0000000-0000-0000-0000-000000000003', {
      id: 'e0000000-0000-0000-0000-000000000003',
      tenantId,
      outletId,
      categoryId: cat2,
      name: 'Diavola Piccante',
      description: 'Spicy Calabrian soppressata, chili-infused hot honey, smoked provolone, fresh oregano',
      basePriceCents: 2250,
      imageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80',
      allergens: ['gluten', 'dairy', 'pork'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.menuItems.set('e0000000-0000-0000-0000-000000000004', {
      id: 'e0000000-0000-0000-0000-000000000004',
      tenantId,
      outletId,
      categoryId: cat3,
      name: 'Tagliatelle al Ragù Bolognese',
      description: 'Slow-braised heritage beef and veal ragù, parmigiano reggiano aged 24 months',
      basePriceCents: 2400,
      imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80',
      allergens: ['gluten', 'dairy', 'egg'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.menuItems.set('e0000000-0000-0000-0000-000000000005', {
      id: 'e0000000-0000-0000-0000-000000000005',
      tenantId,
      outletId,
      categoryId: cat4,
      name: 'Sicilian Blood Orange Spritz',
      description: 'Solerno blood orange liqueur, prosecco superiore, club soda, rosemary sprig',
      basePriceCents: 1400,
      imageUrl: 'https://images.unsplash.com/photo-1560512823-829485b8bf24?auto=format&fit=crop&w=600&q=80',
      allergens: [],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 6. Seed a sample active order for KDS
    const seedOrderId = 'ord_demo_001';
    this.orders.set(seedOrderId, {
      id: seedOrderId,
      tenantId,
      outletId,
      tableId: 'c0000000-0000-0000-0000-000000000002',
      tableNumber: 'T-02',
      status: 'CONFIRMED',
      items: [
        {
          id: 'item_01',
          menuItemId: 'e0000000-0000-0000-0000-000000000002',
          name: 'Margherita Verace D.O.P.',
          unitPriceCents: 1900,
          quantity: 1,
          selectedModifiers: [
            {
              modifierGroupId: 'f0000000-0000-0000-0000-000000000001',
              modifierGroupName: 'Crust Preference',
              optionId: 'g0000000-0000-0000-0000-000000000001',
              optionName: 'Classic Neapolitan Sourdough',
              priceDeltaCents: 0,
            },
          ],
          itemTotalCents: 1900,
          notes: 'Crispy crust please',
        },
        {
          id: 'item_02',
          menuItemId: 'e0000000-0000-0000-0000-000000000005',
          name: 'Sicilian Blood Orange Spritz',
          unitPriceCents: 1400,
          quantity: 2,
          selectedModifiers: [],
          itemTotalCents: 2800,
        },
      ],
      subtotalCents: 4700,
      taxCents: 388,
      tipCents: 800,
      totalCents: 5888,
      guestNotes: 'Celebrating anniversary',
      createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  public getMenu(outletId: string) {
    const cats = Array.from(this.categories.values())
      .filter((c) => c.outletId === outletId && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const items = Array.from(this.menuItems.values()).filter(
      (item) => item.outletId === outletId
    );

    return {
      categories: cats,
      items,
    };
  }

  public getKdsOrders(outletId: string): Order[] {
    return Array.from(this.orders.values())
      .filter(
        (o) =>
          o.outletId === outletId &&
          (o.status === 'CONFIRMED' ||
            o.status === 'PREPARING' ||
            o.status === 'READY_FOR_PICKUP')
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }

  public updateOrderStatus(orderId: string, status: OrderStatus): Order | null {
    const order = this.orders.get(orderId);
    if (!order) return null;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    return order;
  }
}
