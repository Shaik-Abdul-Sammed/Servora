const API_BASE = window.location.origin;

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('abiruchi_staff_token');
  const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}), ...opts.headers };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  return res;
}

function renderNav(activePage) {
  const pages = [
    { href: '/staff/confirm', label: '✅ Confirm Orders', id: 'confirm' },
    { href: '/staff/tickets', label: '🎫 Ticket Rail', id: 'tickets' },
    { href: '/staff/requests', label: '🔔 Guest Requests', id: 'requests' },
    { href: '/staff/tokens', label: '🎟️ Token Board', id: 'tokens' },
  ];
  return `<nav class="sidebar" style="overflow-y:auto; max-height:100vh; overscroll-behavior-y:contain;">
    <div class="sidebar-brand">🍽️ Staff Panel</div>
    ${pages.map(p => `<a href="${p.href}" class="nav-link ${p.id === activePage ? 'active' : ''}">${p.label}</a>`).join('')}
    <div style="margin-top:auto; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08);">
      <a href="/waiter" class="nav-link" target="_blank" rel="noopener noreferrer">📱 Waiter Terminal</a>
      <a href="/" class="nav-link" target="_blank" rel="noopener noreferrer">👁️ Guest View</a>
    </div>
  </nav>`;
}

function showToast(msg, type = 'success') {
  const existing = document.getElementById('staffToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'staffToast';
  toast.style.cssText = `position:fixed;top:16px;right:16px;padding:12px 20px;border-radius:12px;font-weight:700;font-size:0.88rem;z-index:1000;background:${type==='error'?'#dc2626':'#059669'};color:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.5);animation:fadeInUp 0.3s ease;`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
