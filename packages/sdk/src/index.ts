import type {
  Order,
  OrderStatus,
  MenuCategory,
  MenuItem,
  QRTableSessionPayload,
} from '../../shared-types/src/index.ts';

export interface ServoraClientOptions {
  baseUrl: string;
  tenantId?: string;
  authToken?: string;
}

export class ServoraClient {
  private baseUrl: string;
  private tenantId?: string;
  private authToken?: string;

  constructor(options: ServoraClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.tenantId = options.tenantId;
    this.authToken = options.authToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (this.tenantId) headers.set('X-Tenant-ID', this.tenantId);
    if (this.authToken) headers.set('Authorization', `Bearer ${this.authToken}`);

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Request failed with status ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  public async getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }

  public async verifyQRSession(params: { token?: string; tableId?: string }): Promise<{
    verified: boolean;
    table: { id: string; tableNumber: string };
    tenant: { id: string; name: string };
  }> {
    const query = params.token ? `token=${params.token}` : `tableId=${params.tableId}`;
    return this.request(`/api/v1/qr/session?${query}`);
  }

  public async getMenu(outletId?: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
    const query = outletId ? `?outletId=${outletId}` : '';
    return this.request(`/api/v1/menu${query}`);
  }

  public async submitOrder(orderPayload: {
    tenantId: string;
    outletId: string;
    tableId: string;
    tableNumber: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      selectedModifiers?: Array<{
        modifierGroupId: string;
        modifierGroupName: string;
        optionId: string;
        optionName: string;
        priceDeltaCents: number;
      }>;
      notes?: string;
    }>;
    guestNotes?: string;
    tipCents?: number;
  }): Promise<Order> {
    return this.request('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });
  }

  public async getOrder(orderId: string): Promise<Order> {
    return this.request(`/api/v1/orders/${orderId}`);
  }

  public async getKdsOrders(outletId?: string): Promise<Order[]> {
    const query = outletId ? `?outletId=${outletId}` : '';
    return this.request(`/api/v1/kds/orders${query}`);
  }

  public async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    return this.request(`/api/v1/kds/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
}
