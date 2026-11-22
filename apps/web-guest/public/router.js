/**
 * Abiruchi Hotel Unified QR Router & Query Deep-Link Manager
 * Resolves QR session into TABLE, TOKEN, BOOKING, or MENU_ONLY
 * Handles query parameters: table, t, mode, open, lang, diet, search, action
 * Manages mobile back-button (popstate) navigation for all modals and sheets
 */
(function() {
  window.AbiruchiHotelRouter = {
    async resolveCurrentRoute() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const directMode = params.get('mode');
      
      // Parse table from path (/table/14, /t/14, /dine/14) or query (?table=14, ?t=14, ?tableId=table_14, ?tableNumber=14)
      const pathMatch = window.location.pathname.match(/\/(?:table|t|dine)\/([a-zA-Z0-9_-]+)/i);
      const pathTable = pathMatch ? pathMatch[1] : null;
      const rawTable = params.get('table') || params.get('t') || params.get('tableNumber') || params.get('tableId') || pathTable;
      let parsedTableNumber = null;
      let parsedTableId = null;

      if (rawTable) {
        if (rawTable.toLowerCase() === 'takeaway' || rawTable.toLowerCase() === 'token') {
          parsedTableNumber = 'Takeaway';
          parsedTableId = 'takeaway';
        } else {
          // Normalize T-14, Table-14, 14 -> 14
          const numericMatch = rawTable.match(/\d+/);
          parsedTableNumber = numericMatch ? numericMatch[0] : rawTable.replace(/^T-?|^Table\s*/i, '').trim();
          parsedTableId = `table-${parsedTableNumber}`;
        }
        try {
          localStorage.setItem('abiruchi_table_num', parsedTableNumber);
        } catch (e) {}
      }

      let route = {
        mode: directMode ? directMode.toUpperCase() : (parsedTableNumber === 'Takeaway' ? 'TOKEN' : 'TABLE'),
        tableId: parsedTableId || (rawTable ? `table-${rawTable}` : 'table_01'),
        tableNumber: parsedTableNumber,
        outletId: params.get('outletId') || 'demo_outlet_01',
        token: token || null,
        callWaiterEnabled: true,
        openAction: params.get('open') || params.get('action') || null,
        lang: params.get('lang') || null,
        diet: params.get('diet') || params.get('filter') || null,
        searchQuery: params.get('search') || params.get('q') || null
      };

      if (token) {
        try {
          const res = await fetch(`/api/v1/qr/session?token=${encodeURIComponent(token)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.session) {
              route.mode = (data.session.mode || (data.session.tableNumber ? 'TABLE' : 'TOKEN')).toUpperCase();
              route.tableNumber = data.session.tableNumber || route.tableNumber;
              route.tableId = data.session.tableId || route.tableId;
              route.outletId = data.session.outletId || route.outletId;
              route.bookingId = data.session.bookingId;
              if (route.tableNumber) {
                try {
                  localStorage.setItem('abiruchi_table_num', String(route.tableNumber));
                } catch (e) {}
              }
            }
          }
        } catch (e) {
          console.warn('[AbiruchiHotelRouter] Token resolution failed:', e);
        }
      }

      this.applyRouteUI(route);
      this.executeRouteActions(route);
      return route;
    },

    applyRouteUI(route) {
      // 1. Table Number Badge & Container Display
      const tableBadge = document.getElementById('tableBadge') || document.querySelector('.table-badge') || document.getElementById('tableBadgeDisplay');
      const tableBadgeContainer = document.getElementById('tableBadgeContainer');
      const titleEl = document.getElementById('tableConfirmationTitle');
      const subtitleEl = document.getElementById('tableConfirmationSubtitle');

      if (route.mode === 'TOKEN' || route.tableNumber === 'Takeaway') {
        if (tableBadge) tableBadge.textContent = '🛍️ Takeaway';
        if (tableBadgeContainer) {
          tableBadgeContainer.innerHTML = '<span style="font-size:0.75rem; font-weight:800; color:var(--primary);">🎟️ Takeaway Mode</span>';
        }
        if (titleEl) titleEl.textContent = 'Takeaway / Parcel Pickup';
        if (subtitleEl) subtitleEl.textContent = '🛍️ Counter Collection • Active Session';
      } else if (route.mode === 'BOOKING') {
        const text = route.bookingId ? `Reserved (Ref: ${route.bookingId})` : 'Reserve a Table';
        if (tableBadge) tableBadge.textContent = text;
        if (titleEl) titleEl.textContent = 'Table Reservation';
        if (subtitleEl) subtitleEl.textContent = route.bookingId ? `Booking Ref: ${route.bookingId}` : 'Select a dining slot';
      } else if (route.mode === 'MENU_ONLY') {
        if (tableBadge) tableBadge.textContent = '📖 Digital Menu';
        if (tableBadgeContainer) {
          tableBadgeContainer.innerHTML = '<span style="font-size:0.75rem; font-weight:800; color:var(--primary);">📖 Digital Menu</span>';
        }
        if (titleEl) titleEl.textContent = 'Digital Menu (Browse Only)';
        if (subtitleEl) subtitleEl.textContent = '👀 Ordering disabled in preview mode';
      } else if (route.tableNumber) {
        if (tableBadge) tableBadge.textContent = `Table ${route.tableNumber}`;
        if (titleEl) titleEl.textContent = `Table ${route.tableNumber} • Confirmed`;
        if (subtitleEl) subtitleEl.textContent = '🟢 Available & Ready • Dine-In Session Active';
      }

      // 2. Hide or show checkout / ordering in browse-only mode
      if (route.mode === 'MENU_ONLY') {
        const cartFab = document.getElementById('cartFab');
        if (cartFab) cartFab.style.display = 'none';
        const floatingCart = document.getElementById('abiruchiFloatingCart') || document.getElementById('floatingCartBar');
        if (floatingCart) floatingCart.style.display = 'none';
      }

      // 3. Call Waiter is ALWAYS enabled and visible
      const floatingCallWaiterBtn = document.getElementById('floatingCallWaiterBtn');
      if (floatingCallWaiterBtn) {
        floatingCallWaiterBtn.style.display = 'flex';
      }
      const callWaiterBtn = document.getElementById('callWaiterBtn');
      if (callWaiterBtn) {
        callWaiterBtn.style.display = 'flex';
      }
    },

    executeRouteActions(route) {
      // Execute after small delay to ensure app.js menu and handlers are initialized
      setTimeout(() => {
        // Language Switch
        if (route.lang && typeof window.switchLanguage === 'function') {
          const l = route.lang.toLowerCase();
          if (['en', 'te', 'hi'].includes(l)) {
            window.switchLanguage(l);
          }
        }

        // Dietary Filter
        if (route.diet && typeof window.toggleDietFilter === 'function') {
          const d = route.diet.toUpperCase();
          if (d === 'VEG') {
            const btn = document.getElementById('filterVegBtn');
            window.toggleDietFilter('VEG', btn);
          } else if (d === 'NON_VEG' || d === 'NONVEG') {
            const btn = document.getElementById('filterNonVegBtn');
            window.toggleDietFilter('NON_VEG', btn);
          } else if (d === 'BESTSELLER' || d === 'POPULAR') {
            const btn = document.getElementById('filterBestsellerBtn');
            window.toggleDietFilter('BESTSELLER', btn);
          }
        }

        // Search Query
        if (route.searchQuery) {
          const searchInput = document.getElementById('searchInput');
          if (searchInput) {
            searchInput.value = route.searchQuery;
            if (typeof window.handleSearch === 'function') {
              window.handleSearch({ target: searchInput });
            }
          }
        }

        // Modal Deep Linking
        if (route.openAction) {
          const action = route.openAction.toLowerCase();
          if (action === 'cart' && typeof window.openCartModal === 'function') {
            window.openCartModal();
          } else if ((action === 'waiter' || action === 'call-waiter') && typeof window.openWaiterModal === 'function') {
            window.openWaiterModal();
          } else if (action === 'history' && typeof window.openHistoryModal === 'function') {
            window.openHistoryModal();
          } else if (action === 'login' && typeof window.openLoginModal === 'function') {
            window.openLoginModal();
          } else if (action === 'table' && typeof window.openTableSelectorModal === 'function') {
            window.openTableSelectorModal();
          } else if (action === 'split' && typeof window.openSplitBillFlow === 'function') {
            window.openSplitBillFlow();
          }
        }
      }, 150);
    }
  };

  // Back Button Navigation / Popstate Listener for mobile bottom sheets and modals
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', (e) => {
      const activeModalSelectors = [
        '#cartModal.active',
        '#waiterModal.active',
        '#tableSelectorModal.active',
        '#dishModal.active',
        '#dishDetailsModal.active',
        '#billPreviewModal.active',
        '#upiPrepaymentModal.active',
        '#orderStatusModal.active',
        '#loginModal.active'
      ];
      let closedAny = false;
      activeModalSelectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) {
          el.classList.remove('active');
          closedAny = true;
        }
      });

      const voiceOverlay = document.getElementById('voiceModalOverlay');
      if (voiceOverlay && voiceOverlay.style.display === 'flex') {
        voiceOverlay.style.display = 'none';
        closedAny = true;
      }

      const historyOverlay = document.getElementById('orderHistoryModalOverlay');
      if (historyOverlay && historyOverlay.style.display === 'flex') {
        historyOverlay.style.display = 'none';
        closedAny = true;
      }

      if (typeof window.unlockBodyScroll === 'function') {
        window.unlockBodyScroll();
      } else {
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
      }
    });

    // Auto-init on DOMContentLoaded
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          window.AbiruchiHotelRouter.resolveCurrentRoute();
        });
      } else {
        window.AbiruchiHotelRouter.resolveCurrentRoute();
      }
    }
  }
})();
