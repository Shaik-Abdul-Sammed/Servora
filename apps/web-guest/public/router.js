/**
 * Abiruchi Hotel Unified QR Router (C7)
 * Resolves QR session into TABLE, TOKEN, BOOKING, or MENU_ONLY
 */
(function() {
  window.AbiruchiHotelRouter = {
    async resolveCurrentRoute() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const tableId = params.get('tableId');
      const directMode = params.get('mode');

      let route = {
        mode: directMode || 'TABLE',
        tableId: tableId || 'table_01',
        tableNumber: null,
        outletId: 'demo_outlet_01',
        token: token || null,
        callWaiterEnabled: true
      };

      if (token) {
        try {
          const res = await fetch(`/api/v1/qr/session?token=${encodeURIComponent(token)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.session) {
              route.mode = data.session.mode || (data.session.tableNumber ? 'TABLE' : 'TOKEN');
              route.tableNumber = data.session.tableNumber;
              route.tableId = data.session.tableId;
              route.outletId = data.session.outletId;
              route.bookingId = data.session.bookingId;
            }
          }
        } catch (e) {
          console.warn('[AbiruchiHotelRouter] Token resolution failed:', e);
        }
      }

      this.applyRouteUI(route);
      return route;
    },

    applyRouteUI(route) {
      // 1. Table Number Badge vs Token/Counter badge
      const tableBadge = document.querySelector('.table-badge') || document.getElementById('tableBadgeDisplay');
      if (tableBadge) {
        if (route.mode === 'TOKEN') {
          tableBadge.textContent = 'Counter / Token Pickup';
        } else if (route.mode === 'BOOKING') {
          tableBadge.textContent = route.bookingId ? 'Reserved Table' : 'Table Reservation';
        } else if (route.mode === 'MENU_ONLY') {
          tableBadge.textContent = 'Digital Menu (Browse)';
        } else if (route.tableNumber) {
          tableBadge.textContent = `Table ${route.tableNumber}`;
        }
      }

      // 2. Hide or show checkout / ordering in browse-only mode
      if (route.mode === 'MENU_ONLY') {
        const cartFab = document.getElementById('cartFab');
        if (cartFab) cartFab.style.display = 'none';
      }

      // 3. Call Waiter is ALWAYS enabled in every mode
      const callWaiterBtn = document.getElementById('callWaiterBtn');
      if (callWaiterBtn) {
        callWaiterBtn.style.display = 'flex';
      }
    }
  };

  // Auto-init on DOMContentLoaded if inside browser
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      window.AbiruchiHotelRouter.resolveCurrentRoute();
    });
  }
})();
