const API_BASE = window.location.origin;

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('abiruchi_owner_token');
  const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}), ...opts.headers };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  return res;
}

function getVenueSegment() {
  return localStorage.getItem('abiruchi_venue_segment') || 'RESTAURANT';
}

function setVenueSegment(seg) {
  localStorage.setItem('abiruchi_venue_segment', seg);
  window.location.reload();
}

function getSegmentConfig(seg) {
  switch (seg) {
    case 'COFFEE':
      return {
        brand: '☕ Abiruchi Hotel Coffee',
        badge: 'Coffee Shop Mode',
        pages: [
          { href: '/owner', label: '📊 Counter Dashboard', id: 'dashboard' },
          { href: '/owner/tokens', label: '🎟️ Order Tokens Queue', id: 'tokens' },
          { href: '/owner/specials', label: '⭐ Today Specials', id: 'specials' },
          { href: '/owner/offers', label: '🏷️ Deals & Combos', id: 'offers' },
          { href: '/owner/beverages', label: '🧃 Milks & Cold Drinks', id: 'beverages' },
          { href: '/owner/availability', label: '🔴 Dairy & Bakery 86', id: 'availability' },
          { href: '/owner/payments', label: '💳 Fast Pay & Verification', id: 'payments' },
          { href: '/owner/settings', label: '⚙️ Settings & QRs', id: 'settings' },
        ],
      };
    case 'BAR':
      return {
        brand: '🍸 Abiruchi Hotel Cocktail Bar',
        badge: 'Bar / Nightclub Mode',
        pages: [
          { href: '/owner', label: '📊 Bar Dashboard', id: 'dashboard' },
          { href: '/owner/orders', label: '🎫 Open Tabs & Tickets', id: 'orders' },
          { href: '/owner/payments', label: '💳 Quick Verify & Tips', id: 'payments' },
          { href: '/owner/specials', label: '🍸 Happy Hour Specials', id: 'specials' },
          { href: '/owner/offers', label: '🏷️ Bar Deals & Promos', id: 'offers' },
          { href: '/owner/beverages', label: '🍾 Kegs & Bottle Inventory', id: 'beverages' },
          { href: '/owner/tokens', label: '🎟️ Drink Station Queue', id: 'tokens' },
          { href: '/owner/availability', label: '🔴 86 Sold Out', id: 'availability' },
          { href: '/owner/staff', label: '👥 Bartenders & Shifts', id: 'staff' },
          { href: '/owner/settings', label: '⚙️ Surge & Settings', id: 'settings' },
        ],
      };
    case 'RESTAURANT':
    default:
      return {
        brand: '🍽️ Abiruchi Hotel Fine Restaurant',
        badge: 'Dining Room Mode',
        pages: [
          { href: '/owner', label: '📊 Floor Dashboard', id: 'dashboard' },
          { href: '/owner/orders', label: '🎫 Ticket Rail & Coursing', id: 'orders' },
          { href: '/owner/bookings', label: '📅 Reservations & Slots', id: 'bookings' },
          { href: '/owner/specials', label: '⭐ Today Chef Specials', id: 'specials' },
          { href: '/owner/offers', label: '🏷️ Smart Combos & Deals', id: 'offers' },
          { href: '/owner/beverages', label: '🍷 Wine & Water Service', id: 'beverages' },
          { href: '/owner/menu', label: '📖 Menu & Photos', id: 'menu' },
          { href: '/owner/availability', label: '🔴 Menu Dayparts 86', id: 'availability' },
          { href: '/owner/payments', label: '💳 Bills & Folios', id: 'payments' },
          { href: '/owner/tokens', label: '🎟️ Takeaway Tokens', id: 'tokens' },
          { href: '/owner/staff', label: '👥 Floor Waiters', id: 'staff' },
          { href: '/owner/settings', label: '⚙️ Venue Settings', id: 'settings' },
        ],
      };
  }
}

function renderNav(activePage) {
  const currentSeg = getVenueSegment();
  const config = getSegmentConfig(currentSeg);

  return `<nav class="sidebar">
    <div class="sidebar-brand">${config.brand}</div>
    <div style="padding:0 12px 14px;">
      <select onchange="setVenueSegment(this.value)" style="width:100%;padding:6px 10px;background:#1e2433;color:#f8fafc;border:1px solid rgba(255,255,255,0.15);border-radius:8px;font-size:0.75rem;font-weight:700;cursor:pointer;">
        <option value="RESTAURANT" ${currentSeg === 'RESTAURANT' ? 'selected' : ''}>🍽️ Restaurant Preset</option>
        <option value="COFFEE" ${currentSeg === 'COFFEE' ? 'selected' : ''}>☕ Coffee Shop Preset</option>
        <option value="BAR" ${currentSeg === 'BAR' ? 'selected' : ''}>🍸 Cocktail Bar Preset</option>
      </select>
    </div>
    ${config.pages.map((p) => `<a href="${p.href}" class="nav-link ${p.id === activePage ? 'active' : ''}">${p.label}</a>`).join('')}
    <div style="margin-top:auto; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08);">
      <a href="/" class="nav-link" target="_blank" rel="noopener noreferrer">👁️ Guest View</a>
    </div>
  </nav>`;
}

function showToast(msg, type = 'success') {
  const existing = document.getElementById('ownerToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'ownerToast';
  toast.style.cssText = `position:fixed;top:16px;right:16px;padding:12px 20px;border-radius:12px;font-weight:700;font-size:0.88rem;z-index:1000;background:${type === 'error' ? '#dc2626' : '#059669'};color:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.5);animation:fadeInUp 0.3s ease;`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
