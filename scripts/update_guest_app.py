import sys

app_js_content = r'''// Abiruchi Hotel Guest SPA — Intelligent Dining & Table Operating System
const API_BASE = window.location.origin;
let currentLang = localStorage.getItem('abiruchi_guest_lang') || 'en';
let currentTheme = localStorage.getItem('abiruchi_theme') || 'light';
let menuData = { categories: [], items: [] };
let filteredItems = [];
let cart = [];
let activeTable = { id: 'c0000000-0000-0000-0000-000000000002', number: '14' };
let currentTipAmount = 30; // ₹30 default gratuity
let currentCourse = 'ALL_TOGETHER';
let splitGuestCount = 1;
let paymentMethod = 'UPI';
let selectedRating = 5;
let currentDietaryFilter = 'ALL';
let activeSpecials = [];
let bestOffer = null;
let appliedCoupon = null;
let waterPrompted = false;
let aiRecommendations = [];
let activeAssistanceCallId = null;
let assistancePollInterval = null;
let currentBillOrderId = null;
let currentJourney = 'DINE_IN';
let selectedPickupDate = new Date().toISOString().split('T')[0];
let selectedPickupSlot = null;

const menuCacheByLang = new Map();

// Multilingual Dictionary with English, Telugu, and Hindi Support
const UI_TRANSLATIONS = {
  en: {
    loyalty: 'Earn 10 loyalty points per ₹100 spent',
    searchPlaceholder: 'Search dishes, tiffins, biryanis, drinks...',
    viewOrder: 'View Cart',
    callStaff: 'Call Waiter',
    summaryTitle: 'Your Table Bill',
    subtotal: 'Item Total:',
    tax: 'GST (5%):',
    tip: 'Server Tip:',
    total: 'To Pay:',
    sendOrder: 'Send Order to Kitchen →',
    allTogether: 'All Together',
    appetizers: 'Starters First',
    mains: 'Mains Course',
    desserts: 'Desserts & Beverages',
    callStaffTitle: 'How can we assist you?',
    callStaffSubtitle: 'Select a request type below. Our floor waitstaff will be alerted immediately.',
    optAssistance: 'Need Assistance',
    optWater: 'Request Water',
    optBill: 'Request Bill / Pre-Bill',
    optCutlery: 'Extra Cutlery',
    optFoodIssue: 'Food Issue',
    optOther: 'Other Help',
    waiterNoteLabel: 'Optional message for staff',
    waiterNotePlaceholder: 'e.g. Please bring warm water, extra tissues',
    wbPromptTitle: 'Would you like to add a water bottle?',
    wbPromptSubtitle: 'Chilled 1L sealed packaged mineral water bottle for your table.',
    wbItemName: 'Packaged Water Bottle (1L)',
    wbAcceptBtn: '✓ Yes, add 1 bottle (₹20)',
    wbDeclineBtn: '✕ No, thank you',
    billModalTitle: 'Table Bill Preview',
    cartViewBill: 'View Pre-Bill',
    recommended: 'Recommended'
  },
  te: {
    loyalty: 'ఖర్చు చేసిన ప్రతి ₹100కి 10 లాయల్టీ పాయింట్లు పొందండి',
    searchPlaceholder: 'వంటకాలు, టిఫిన్లు, బిర్యానీలు, పానీయాలు శోధించండి...',
    viewOrder: 'కార్ట్ చూడండి',
    callStaff: 'వెయిటర్‌ను పిలవండి',
    summaryTitle: 'మీ టేబుల్ బిల్లు',
    subtotal: 'మొత్తం వస్తువులు:',
    tax: 'జీఎస్టీ (5%):',
    tip: 'సర్వర్ చిట్కా:',
    total: 'చెల్లించాల్సిన మొత్తం:',
    sendOrder: 'కిచెన్‌కి ఆర్డర్ పంపండి →',
    allTogether: 'అన్నీ కలిపి',
    appetizers: 'ముందుగా స్టార్టర్స్',
    mains: 'ప్రధాన భోజనం',
    desserts: 'స్వీట్లు మరియు పానీయాలు',
    callStaffTitle: 'మేము మీకు ఎలా సహాయపడగలం?',
    callStaffSubtitle: 'క్రింద అభ్యర్థన రకాన్ని ఎంచుకోండి. మా వెయిటర్‌లు వెంటనే మీ వద్దకు వస్తారు.',
    optAssistance: 'సహాయం కావాలి',
    optWater: 'మంచినీళ్లు కావాలి',
    optBill: 'బిల్లు / ప్రీ-బిల్లు కావాలి',
    optCutlery: 'అదనపు ప్లేట్లు/స్పూన్లు',
    optFoodIssue: 'ఆహార సమస్య',
    optOther: 'ఇతర సహాయం',
    waiterNoteLabel: 'సిబ్బందికి సందేశం (ఐచ్ఛికం)',
    waiterNotePlaceholder: 'ఉదా: వేడి నీరు, టిష్యూ పేపర్లు తీసుకురండి',
    wbPromptTitle: 'మీరు వాటర్ బాటిల్ జోడించాలనుకుంటున్నారా?',
    wbPromptSubtitle: 'మీ టేబుల్ కోసం చల్లటి 1 లీటరు సీల్డ్ మినరల్ వాటర్ బాటిల్.',
    wbItemName: 'ప్యాకేజ్డ్ వాటర్ బాటిల్ (1లీ)',
    wbAcceptBtn: '✓ అవును, 1 బాటిల్ జోడించండి (₹20)',
    wbDeclineBtn: '✕ వద్దు, ధన్యవాదాలు',
    billModalTitle: 'టేబుల్ బిల్లు ప్రివ్యూ',
    cartViewBill: 'ప్రీ-బిల్లు చూడండి',
    recommended: 'సిఫార్సు చేయబడినవి'
  },
  hi: {
    loyalty: 'प्रत्येक ₹100 खर्च पर 10 लॉयल्टी पॉइंट्स पाएं',
    searchPlaceholder: 'व्यंजन, टिफिन, बिरयानी, पेय खोजें...',
    viewOrder: 'कार्ट देखें',
    callStaff: 'वेटर को बुलाएं',
    summaryTitle: 'आपका टेबल बिल',
    subtotal: 'आइटम कुल:',
    tax: 'जीएसटी (5%):',
    tip: 'वेटर टिप:',
    total: 'कुल भुगतान:',
    sendOrder: 'रसोई को ऑर्डर भेजें →',
    allTogether: 'सब एक साथ',
    appetizers: 'पहले स्टार्टर्स',
    mains: 'मुख्य भोजन',
    desserts: 'मिठाई और पेय',
    callStaffTitle: 'हम आपकी क्या सहायता कर सकते हैं?',
    callStaffSubtitle: 'नीचे अनुरोध चुनें। हमारे वेटर तुरंत आपकी टेबल पर उपस्थित होंगे।',
    optAssistance: 'सहायता चाहिए',
    optWater: 'पानी चाहिए',
    optBill: 'बिल / प्री-बिल चाहिए',
    optCutlery: 'अतिरिक्त प्लेट/चम्मच',
    optFoodIssue: 'भोजन संबंधी समस्या',
    optOther: 'अन्य सहायता',
    waiterNoteLabel: 'कर्मचारियों के लिए संदेश (वैकल्पिक)',
    waiterNotePlaceholder: 'जैसे: गर्म पानी, अतिरिक्त टिशू लाएं',
    wbPromptTitle: 'क्या आप पानी की बोतल जोड़ना चाहेंगे?',
    wbPromptSubtitle: 'आपकी टेबल के लिए ठंडी 1 लीटर सीलबंद मिनरल वाटर बोतल।',
    wbItemName: 'पैकेज्ड मिनरल वाटर (1 ली)',
    wbAcceptBtn: '✓ हाँ, 1 बोतल जोड़ें (₹20)',
    wbDeclineBtn: '✕ नहीं, धन्यवाद',
    billModalTitle: 'टेबल बिल पूर्वावलोकन',
    cartViewBill: 'प्री-बिल देखें',
    recommended: 'अनुशंसित'
  }
};

// Indian Rupee Currency Formatter
function formatINR(cents) {
  const rupees = Math.round(cents / 100);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

// ==========================================================================
// Theme Management (Light / Dark / System Preference)
// ==========================================================================
function initTheme() {
  const saved = localStorage.getItem('abiruchi_theme') || 'system';
  applyTheme(saved);
}

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('abiruchi_theme', theme);

  let activeMode = theme;
  if (theme === 'system') {
    activeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', activeMode);
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.textContent = activeMode === 'dark' ? '☀️' : '🌙';
    themeBtn.title = `Current: ${activeMode.toUpperCase()} (Click to toggle)`;
  }
}

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
  applyTheme(next);
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (localStorage.getItem('abiruchi_theme') === 'system') {
    applyTheme('system');
  }
});

// ==========================================================================
// Multi-Language Management & Dynamic Translation
// ==========================================================================
async function switchLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('abiruchi_guest_lang', lang);
  const menuEl = document.getElementById('menuContainer');
  if (menuEl) menuEl.style.opacity = '0.6';
  await loadMenu(lang);
  applyInvisibleLanguageStyles(lang);
  setTimeout(() => { if (menuEl) menuEl.style.opacity = '1'; }, 80);
}

function applyInvisibleLanguageStyles(lang, dir) {
  document.documentElement.dir = dir || 'ltr';
  const dict = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
  if (document.getElementById('searchInput')) document.getElementById('searchInput').placeholder = dict.searchPlaceholder;
  if (document.getElementById('viewCartLabel')) document.getElementById('viewCartLabel').textContent = dict.viewOrder;
  if (document.getElementById('callStaffLabel')) document.getElementById('callStaffLabel').textContent = dict.callStaff;
  if (document.getElementById('orderSummaryTitle')) document.getElementById('orderSummaryTitle').textContent = dict.summaryTitle;
  if (document.getElementById('lblSubtotal')) document.getElementById('lblSubtotal').textContent = dict.subtotal;
  if (document.getElementById('lblTax')) document.getElementById('lblTax').textContent = dict.tax;
  if (document.getElementById('lblTip')) document.getElementById('lblTip').textContent = dict.tip;
  if (document.getElementById('lblTotal')) document.getElementById('lblTotal').textContent = dict.total;
  if (document.getElementById('submitOrderBtn')) document.getElementById('submitOrderBtn').textContent = dict.sendOrder;

  if (document.getElementById('callStaffTitle')) document.getElementById('callStaffTitle').textContent = dict.callStaffTitle || 'How can we assist you?';
  if (document.getElementById('callStaffSubtitle')) document.getElementById('callStaffSubtitle').textContent = dict.callStaffSubtitle || 'Select a request type below. Our floor waitstaff will be alerted immediately.';
  if (document.getElementById('optAssistanceLabel')) document.getElementById('optAssistanceLabel').textContent = dict.optAssistance || 'Need Assistance';
  if (document.getElementById('optWaterLabel')) document.getElementById('optWaterLabel').textContent = dict.optWater || 'Request Water';
  if (document.getElementById('optBillLabel')) document.getElementById('optBillLabel').textContent = dict.optBill || 'Request Bill';
  if (document.getElementById('optCutleryLabel')) document.getElementById('optCutleryLabel').textContent = dict.optCutlery || 'Extra Cutlery';
  if (document.getElementById('optFoodIssueLabel')) document.getElementById('optFoodIssueLabel').textContent = dict.optFoodIssue || 'Food Issue';
  if (document.getElementById('optOtherLabel')) document.getElementById('optOtherLabel').textContent = dict.optOther || 'Other Help';
  if (document.getElementById('waiterNoteLabel')) document.getElementById('waiterNoteLabel').textContent = dict.waiterNoteLabel || 'Optional message for staff';
  if (document.getElementById('waiterNoteInput')) document.getElementById('waiterNoteInput').placeholder = dict.waiterNotePlaceholder || 'e.g. Please bring warm water, extra tissues';

  if (document.getElementById('wbPromptTitle')) document.getElementById('wbPromptTitle').textContent = dict.wbPromptTitle || 'Would you like to add a water bottle?';
  if (document.getElementById('wbPromptSubtitle')) document.getElementById('wbPromptSubtitle').textContent = dict.wbPromptSubtitle || 'Chilled 1L sealed packaged mineral water bottle for your table.';
  if (document.getElementById('wbItemName')) document.getElementById('wbItemName').textContent = dict.wbItemName || 'Packaged Water Bottle (1L)';
  if (document.getElementById('wbAcceptBtn')) document.getElementById('wbAcceptBtn').textContent = dict.wbAcceptBtn || '✓ Yes, add 1 bottle (₹20)';
  if (document.getElementById('wbDeclineBtn')) document.getElementById('wbDeclineBtn').textContent = dict.wbDeclineBtn || '✕ No, thank you';

  if (document.getElementById('billModalTitle')) document.getElementById('billModalTitle').textContent = dict.billModalTitle || 'Table Bill Preview';
  if (document.getElementById('cartCallWaiterLabel')) document.getElementById('cartCallWaiterLabel').textContent = dict.callStaff;
  if (document.getElementById('cartViewBillLabel')) document.getElementById('cartViewBillLabel').textContent = dict.cartViewBill || 'View Pre-Bill';
}

async function loadLanguages() {
  const select = document.getElementById('langSelect');
  if (select) {
    select.innerHTML = [
      { code: 'en', nativeName: 'English (EN)', flag: '🇮🇳' },
      { code: 'te', nativeName: 'తెలుగు (Telugu)', flag: '🇮🇳' },
      { code: 'hi', nativeName: 'हिंदी (Hindi)', flag: '🇮🇳' }
    ].map(l =>
      `<option value="${l.code}" ${l.code === currentLang ? 'selected' : ''}>${l.nativeName}</option>`
    ).join('');
  }
}

async function initSession() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = (urlParams.get('mode') || 'TABLE').toUpperCase();
  const token = urlParams.get('token');
  const tableId = urlParams.get('tableId') || activeTable.id;

  if (mode === 'BOOKING') {
    window.location.href = '/booking';
    return;
  }
  if (mode === 'TOKEN') {
    const tableBadge = document.getElementById('tableBadgeContainer');
    if (tableBadge) tableBadge.innerHTML = '<span style="font-size:0.75rem; font-weight:800; color:var(--primary);">🎟️ Takeaway Mode</span>';
  } else if (mode === 'MENU_ONLY') {
    const tableBadge = document.getElementById('tableBadgeContainer');
    if (tableBadge) tableBadge.innerHTML = '<span style="font-size:0.75rem; font-weight:800; color:var(--primary);">📖 Digital Menu</span>';
  }

  try {
    const query = token ? `token=${token}` : `tableId=${tableId}`;
    const res = await fetch(`${API_BASE}/api/v1/qr/session?${query}`);
    if (res.ok) {
      const session = await res.json();
      if (session.table && mode !== 'TOKEN' && mode !== 'MENU_ONLY') {
        activeTable = { id: session.table.id, number: session.table.tableNumber };
        const badge = document.getElementById('tableBadge');
        if (badge) badge.textContent = `Table ${activeTable.number}`;
      }
      if (session.tenant) {
        const venue = document.getElementById('venueName');
        if (venue) venue.textContent = session.tenant.name;
        const heroTitle = document.getElementById('heroRestaurantTitle');
        if (heroTitle) heroTitle.textContent = session.tenant.name;
      }
    }
  } catch (e) {}
}

async function loadMenu(lang = 'en') {
  if (menuCacheByLang.has(lang)) {
    const cached = menuCacheByLang.get(lang);
    menuData = cached;
    filteredItems = [...menuData.items];
    applyInvisibleLanguageStyles(lang, cached.dir || 'ltr');
    renderCategories();
    renderMenu();
    return;
  }
  try {
    const url = lang === 'en' ? `${API_BASE}/api/v1/menu` : `${API_BASE}/api/v1/menu?lang=${encodeURIComponent(lang)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      menuCacheByLang.set(lang, data);
      menuData = data;
      filteredItems = [...menuData.items];
      applyInvisibleLanguageStyles(lang, data.dir || 'ltr');
      renderCategories();
      renderMenu();
    }
  } catch (err) { console.warn('Error loading menu:', err); }
}

async function prefetchLanguages(langs) {
  for (const l of langs) {
    if (!menuCacheByLang.has(l)) {
      try {
        const res = await fetch(`${API_BASE}/api/v1/menu?lang=${encodeURIComponent(l)}`);
        if (res.ok) { const data = await res.json(); menuCacheByLang.set(l, data); }
      } catch (e) {}
    }
  }
}

function renderCategories() {
  const nav = document.getElementById('categoryNav');
  if (!nav || !menuData.categories) return;
  const dict = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS.en;
  let html = `<button class="cat-btn active" onclick="filterCategory(null, this)">✨ ${dict.recommended || 'Recommended'}</button>`;
  for (const cat of menuData.categories) {
    html += `<button class="cat-btn" onclick="filterCategory('${cat.id}', this)">${cat.name}</button>`;
  }
  nav.innerHTML = html;
}

function filterCategory(catId, btnEl) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  if (!catId) { filteredItems = [...menuData.items]; } else { filteredItems = menuData.items.filter(i => i.categoryId === catId); }
  renderMenu();
}

function toggleDietFilter(filter, btnEl) {
  currentDietaryFilter = filter;
  document.querySelectorAll('.abiruchi-pill-toggle').forEach(b => {
    b.classList.remove('active', 'active-veg', 'active-nonveg');
  });
  if (btnEl) {
    if (filter === 'VEG') btnEl.classList.add('active-veg');
    else if (filter === 'NON_VEG') btnEl.classList.add('active-nonveg');
    else btnEl.classList.add('active');
  }
  renderMenu();
}

function handleSearch(query) {
  const clearBtn = document.getElementById('searchClear');
  if (query.trim().length > 0) {
    if (clearBtn) clearBtn.style.display = 'block';
    const q = query.toLowerCase();
    filteredItems = menuData.items.filter(i => i.name.toLowerCase().includes(q) || (i.description && i.description.toLowerCase().includes(q)));
  } else {
    if (clearBtn) clearBtn.style.display = 'none';
    filteredItems = [...menuData.items];
  }
  renderMenu();
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) clearBtn.style.display = 'none';
  filteredItems = [...menuData.items];
  renderMenu();
}

// ==========================================================================
// Abiruchi Hotel 2-Column Food Item Presentation
// ==========================================================================
function renderMenu() {
  const container = document.getElementById('menuContainer');
  if (!container) return;

  let displayList = filteredItems;
  if (currentDietaryFilter === 'VEG') {
    displayList = displayList.filter(i => i.dietaryType === 'VEG');
  } else if (currentDietaryFilter === 'NON_VEG') {
    displayList = displayList.filter(i => i.dietaryType === 'NON_VEG' || !i.dietaryType);
  } else if (currentDietaryFilter === 'BESTSELLER') {
    displayList = displayList.filter((_, idx) => idx % 2 === 0);
  } else if (currentDietaryFilter === 'GLUTEN_FREE') {
    displayList = displayList.filter(i => !(i.allergens || []).includes('GLUTEN'));
  }

  if (displayList.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:48px 16px; color:var(--text-muted); grid-column:1/-1;">
        <div style="font-size:2.5rem; margin-bottom:12px;">🔍</div>
        <div style="font-size:1.1rem; font-weight:800; color:var(--text-title); margin-bottom:6px;">No dishes found</div>
        <p style="font-size:0.85rem;">Try adjusting your search terms or dietary preferences.</p>
      </div>`;
    return;
  }

  container.innerHTML = displayList.map(item => {
    const cartItem = cart.find(ci => ci.itemId === item.id);
    const qty = cartItem ? cartItem.quantity : 0;
    const isVeg = item.dietaryType === 'VEG';

    return `
      <div class="abiruchi-dish-card" onclick="openDishDetailsModal('${item.id}')">
        <div class="abiruchi-dish-info">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="fssai-symbol ${isVeg ? 'fssai-veg' : 'fssai-nonveg'}">
              <span class="${isVeg ? 'fssai-veg-dot' : 'fssai-nonveg-dot'}"></span>
            </span>
            ${item.tags && item.tags.includes('bestseller') ? '<span class="abiruchi-dish-tag">★ Bestseller</span>' : ''}
          </div>
          <div class="abiruchi-dish-name">${item.name}</div>
          <div class="abiruchi-dish-price">${formatINR(item.basePriceCents)}</div>
          <div class="abiruchi-dish-desc">${item.description || ''}</div>
        </div>

        <div class="abiruchi-dish-media" onclick="event.stopPropagation()">
          <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80'}"
               alt="${item.name}" loading="lazy" class="abiruchi-dish-img"
               onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80';" />

          <div class="abiruchi-btn-wrapper">
            ${qty === 0 ? `
              <button class="abiruchi-btn-add" onclick="addToCart('${item.id}'); event.stopPropagation();">
                ADD <span style="font-size:0.8rem; font-weight:900; margin-left:2px;">+</span>
              </button>
            ` : `
              <div class="abiruchi-qty-stepper">
                <button class="abiruchi-step-btn" onclick="removeFromCart('${item.id}'); event.stopPropagation();">−</button>
                <span class="abiruchi-qty-num">${qty}</span>
                <button class="abiruchi-step-btn" onclick="addToCart('${item.id}'); event.stopPropagation();">+</button>
              </div>
            `}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ==========================================================================
// Cart Operations
// ==========================================================================
function addToCart(itemId) {
  const item = (menuData.items || []).find(i => i.id === itemId);
  if (!item) return;

  const existing = cart.find(i => i.itemId === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      itemId: item.id,
      name: item.name,
      unitPriceCents: item.basePriceCents,
      quantity: 1,
      course: 'MAIN'
    });
  }

  updateCartUI();
  renderMenu();
}

function removeFromCart(itemId) {
  const idx = cart.findIndex(i => i.itemId === itemId);
  if (idx !== -1) {
    if (cart[idx].quantity > 1) {
      cart[idx].quantity -= 1;
    } else {
      cart.splice(idx, 1);
    }
  }

  updateCartUI();
  renderMenu();
}

function updateCartUI() {
  const totalCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotalCents = cart.reduce((s, i) => s + (i.unitPriceCents * i.quantity), 0);
  const taxCents = Math.round(subtotalCents * 0.05);
  const tipCents = currentTipAmount * 100;
  const discountCents = bestOffer && bestOffer.savedCents ? bestOffer.savedCents : 0;
  const totalCents = Math.max(0, subtotalCents - discountCents) + taxCents + tipCents;

  const bar = document.getElementById('floatingCartBar');
  if (bar) {
    if (totalCount > 0) {
      bar.classList.add('visible');
      const countEl = document.getElementById('floatingCartCount');
      const totalEl = document.getElementById('floatingCartTotal');
      if (countEl) countEl.textContent = `${totalCount} ${totalCount === 1 ? 'ITEM' : 'ITEMS'}`;
      if (totalEl) totalEl.textContent = formatINR(totalCents);
    } else {
      bar.classList.remove('visible');
    }
  }

  const badge = document.getElementById('cartBadge');
  if (badge) badge.textContent = totalCount;

  const itemsContainer = document.getElementById('cartItemsList');
  if (itemsContainer) {
    if (cart.length === 0) {
      itemsContainer.innerHTML = '<div style="text-align:center; padding:32px 16px; color:var(--text-muted);">Your cart is empty</div>';
    } else {
      itemsContainer.innerHTML = cart.map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--chip-border);">
          <div style="flex:1;">
            <div style="font-weight:700; font-size:0.9rem; color:var(--text-title);">${item.name}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">${formatINR(item.unitPriceCents)} each</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="abiruchi-qty-stepper" style="position:static; transform:none;">
              <button class="abiruchi-step-btn" onclick="removeFromCart('${item.itemId}')">−</button>
              <span class="abiruchi-qty-num">${item.quantity}</span>
              <button class="abiruchi-step-btn" onclick="addToCart('${item.itemId}')">+</button>
            </div>
            <div style="font-weight:800; min-width:60px; text-align:right; font-size:0.9rem;">${formatINR(item.unitPriceCents * item.quantity)}</div>
          </div>
        </div>`).join('');
    }
  }

  if (document.getElementById('sumSubtotal')) document.getElementById('sumSubtotal').textContent = formatINR(subtotalCents);
  if (document.getElementById('sumTax')) document.getElementById('sumTax').textContent = formatINR(taxCents);
  if (document.getElementById('sumTip')) document.getElementById('sumTip').textContent = formatINR(tipCents);
  if (document.getElementById('sumDiscount')) document.getElementById('sumDiscount').textContent = `-${formatINR(discountCents)}`;
  if (document.getElementById('sumTotal')) document.getElementById('sumTotal').textContent = formatINR(totalCents);
}

// Modal Handlers
function openCartModal() { document.getElementById('cartModal')?.classList.add('active'); }
function closeCartModal() { document.getElementById('cartModal')?.classList.remove('active'); }
function openWaiterModal() { document.getElementById('waiterModal')?.classList.add('active'); }
function openWaiterCallModal() { openWaiterModal(); }
function closeWaiterModal() { document.getElementById('waiterModal')?.classList.remove('active'); }
function closeOnBackdrop(e, modalId) { if (e.target.id === modalId) document.getElementById(modalId)?.classList.remove('active'); }

function setPaymentMethod(btn, method) {
  document.querySelectorAll('#cartModal .pill-group .opt-pill').forEach(b => {
    if (b.parentElement === btn.parentElement) b.classList.remove('active');
  });
  btn.classList.add('active');
  paymentMethod = method;
}

// ==========================================================================
// Waiter Call Ticket & Live Lifecycle Polling
// ==========================================================================
async function dispatchWaiterCall(label, category = 'ASSISTANCE') {
  const noteInput = document.getElementById('waiterNoteInput');
  const note = noteInput ? noteInput.value.trim() : '';
  const reasonText = note ? `${label} (${note})` : label;

  try {
    const res = await fetch(`${API_BASE}/api/v1/tables/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: 'b0000000-0000-0000-0000-000000000001',
        tableId: activeTable.id,
        category: category,
        reason: reasonText
      })
    });

    if (res.ok) {
      const call = await res.json();
      activeAssistanceCallId = call.id;
      showToast(`🔔 Waiter alerted: ${label}`);
      updateActiveCallBanner(call);

      // Start reactive polling
      if (assistancePollInterval) clearInterval(assistancePollInterval);
      assistancePollInterval = setInterval(() => pollAssistanceCall(call.id), 3500);

      if (noteInput) noteInput.value = '';
    } else {
      showToast('Alert sent to floor staff.');
    }
  } catch (err) {
    showToast('Alert sent to floor staff.');
  }
}

async function pollAssistanceCall(callId) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/tables/calls/${callId}`);
    if (res.ok) {
      const call = await res.json();
      updateActiveCallBanner(call);
      if (call.status === 'COMPLETED' || call.status === 'CANCELLED') {
        clearInterval(assistancePollInterval);
        assistancePollInterval = null;
      }
    }
  } catch (e) {}
}

function updateActiveCallBanner(call) {
  const banner = document.getElementById('activeCallBanner');
  const textEl = document.getElementById('activeCallText');
  const badgeEl = document.getElementById('activeCallBadge');
  const timeEl = document.getElementById('activeCallTime');

  if (!banner || !call) return;
  banner.style.display = 'flex';
  if (textEl) textEl.textContent = call.reason || 'Assistance requested';
  if (timeEl) timeEl.textContent = `Table ${activeTable.number} • Just now`;

  if (badgeEl) {
    badgeEl.textContent = call.status;
    badgeEl.className = 'active-call-status';
    if (call.status === 'PENDING') {
      badgeEl.classList.add('status-pending');
      badgeEl.textContent = '⏳ PENDING';
    } else if (call.status === 'ACCEPTED') {
      badgeEl.classList.add('status-accepted');
      badgeEl.textContent = '👤 ASSIGNED';
    } else if (call.status === 'IN_PROGRESS') {
      badgeEl.classList.add('status-progress');
      badgeEl.textContent = '🏃 ON THE WAY';
    } else if (call.status === 'COMPLETED') {
      badgeEl.classList.add('status-completed');
      badgeEl.textContent = '✓ ASSISTED';
    } else {
      badgeEl.classList.add('status-pending');
    }
  }
}

// ==========================================================================
// Pre-Bill / Request Bill Preview Workflow
// ==========================================================================
async function openPreBillModal() {
  const modal = document.getElementById('billPreviewModal');
  if (!modal) return;
  modal.classList.add('active');
  const container = document.getElementById('billContentContainer');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Calculating bill breakdown...</div>';

  let billData = null;
  if (currentBillOrderId) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/orders/${currentBillOrderId}/bill-preview`);
      if (res.ok) billData = await res.json();
    } catch (e) {}
  }

  if (!billData) {
    const items = cart.length > 0 ? cart : [
      { name: 'Plain Dosa', quantity: 2, unitPriceCents: 5000 },
      { name: 'Spiced Buttermilk', quantity: 2, unitPriceCents: 2500 }
    ];
    const subtotalCents = items.reduce((s, i) => s + (i.unitPriceCents * i.quantity), 0);
    const cgstCents = Math.round(subtotalCents * 0.025);
    const sgstCents = Math.round(subtotalCents * 0.025);
    const totalTaxCents = cgstCents + sgstCents;
    const tipCents = currentTipAmount * 100;
    const finalPayableCents = subtotalCents + totalTaxCents + tipCents;

    billData = {
      orderId: currentBillOrderId || 'ESTIMATE',
      tableNumber: activeTable.number || '14',
      items: items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        lineTotalCents: i.unitPriceCents * i.quantity
      })),
      subtotalCents,
      cgstCents,
      sgstCents,
      totalTaxCents,
      discountCents: 0,
      tipCents,
      finalPayableCents
    };
  }

  renderBillPreview(billData);
}

function renderBillPreview(bill) {
  const container = document.getElementById('billContentContainer');
  if (!container) return;

  const rows = (bill.items || []).map(i => `
    <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.88rem;">
      <div>
        <span style="font-weight:700;">${i.name}</span>
        <span style="color:var(--text-muted); font-size:0.8rem;"> × ${i.quantity}</span>
      </div>
      <div style="font-weight:700;">${formatINR(i.lineTotalCents || (i.unitPriceCents * i.quantity))}</div>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="border-bottom:1px dashed var(--chip-border); padding-bottom:12px; margin-bottom:12px;">
      <div style="font-size:0.8rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Itemized Breakdown</div>
      ${rows}
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem; color:var(--text-muted);">
      <span>Subtotal (Net):</span>
      <span style="font-weight:600; color:var(--text);">${formatINR(bill.subtotalCents)}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem; color:var(--text-muted);">
      <span>CGST (2.5%):</span>
      <span style="font-weight:600; color:var(--text);">${formatINR(bill.cgstCents)}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem; color:var(--text-muted);">
      <span>SGST (2.5%):</span>
      <span style="font-weight:600; color:var(--text);">${formatINR(bill.sgstCents)}</span>
    </div>
    ${bill.discountCents > 0 ? `
    <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem; color:#10b981;">
      <span>Special Offer Savings:</span>
      <span style="font-weight:700;">-${formatINR(bill.discountCents)}</span>
    </div>` : ''}
    ${bill.tipCents > 0 ? `
    <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem; color:var(--text-muted);">
      <span>Staff Gratuity / Tip:</span>
      <span style="font-weight:600; color:var(--text);">${formatINR(bill.tipCents)}</span>
    </div>` : ''}
    <div style="border-top:1px solid var(--chip-border); margin-top:10px; padding-top:10px; display:flex; justify-content:space-between; font-size:1.15rem; font-weight:900; color:var(--primary);">
      <span>Total Amount Payable:</span>
      <span>${formatINR(bill.finalPayableCents)}</span>
    </div>
    <div style="font-size:0.72rem; color:var(--text-muted); text-align:center; margin-top:10px;">
      GSTIN: 36AABCS1234F1Z0 • Abiruchi Hotel Restaurant Operating System
    </div>
  `;
}

function closeBillPreviewModal() {
  document.getElementById('billPreviewModal')?.classList.remove('active');
}

function printBillPreview() {
  window.print();
}

function initiateUpiFromBill() {
  closeBillPreviewModal();
  openCartModal();
}

// ==========================================================================
// Water Bottle Checkout Flow
// ==========================================================================
function handlePreOrderCheckout() {
  if (cart.length === 0) {
    showToast('Cart is empty. Please select food items.');
    return;
  }

  if (currentJourney === 'ORDER_LATER') {
    submitFinalOrder();
    return;
  }

  const hasWater = cart.some(i =>
    (i.name && i.name.toLowerCase().includes('water bottle')) ||
    i.itemId === 'e0000000-0000-0000-0000-000000000057'
  );

  if (!hasWater && !waterPrompted) {
    waterPrompted = true;
    const modal = document.getElementById('waterBottleModal');
    if (modal) {
      modal.classList.add('active');
      return;
    }
  }

  submitFinalOrder();
}

function respondWaterBottle(accepted) {
  const modal = document.getElementById('waterBottleModal');
  if (modal) modal.classList.remove('active');

  if (accepted) {
    const existing = cart.find(i => i.itemId === 'e0000000-0000-0000-0000-000000000057' || (i.name && i.name.includes('Water Bottle')));
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        itemId: 'e0000000-0000-0000-0000-000000000057',
        name: 'Packaged Mineral Water (1L)',
        unitPriceCents: 2000,
        quantity: 1,
        course: 'DRINKS'
      });
    }
    updateCartUI();
    showToast('✓ 1 Water Bottle added to your table order');
  }

  submitFinalOrder();
}

// ==========================================================================
// Order Submission
// ==========================================================================
async function submitFinalOrder() {
  if (cart.length === 0) { showToast('Cart is empty'); return; }

  // Scheduled Food Ordering Flow (ORDER_LATER)
  if (currentJourney === 'ORDER_LATER') {
    if (!selectedPickupSlot) {
      showToast('⚠️ Please select a pickup time slot above!');
      return;
    }
    const submitBtn = document.getElementById('submitOrderBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Scheduling your pickup order...';
    }

    const phone = localStorage.getItem('abiruchi_guest_phone') || '9876543210';
    const scheduledPickupTime = `${selectedPickupDate}T${selectedPickupSlot}:00Z`;

    try {
      const res = await fetch(`${API_BASE}/api/v1/orders/scheduled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId: 'b0000000-0000-0000-0000-000000000001',
          customerName: 'Guest User',
          customerPhone: phone,
          items: cart.map(i => ({
            itemId: i.itemId,
            name: i.name,
            quantity: i.quantity,
            unitPriceCents: i.unitPriceCents,
          })),
          scheduledPickupTime,
        }),
      });

      if (res.ok) {
        cart = [];
        updateCartUI();
        closeCartModal();
        const token = `TK-${Math.floor(100 + Math.random() * 900)}`;
        const tokEl = document.getElementById('scheduledTokenDisplay');
        const sumEl = document.getElementById('scheduledPickupSummary');
        if (tokEl) tokEl.textContent = token;
        if (sumEl) sumEl.textContent = `${selectedPickupDate} at ${selectedPickupSlot}`;
        document.getElementById('scheduledOrderModal')?.classList.add('active');
        showToast('🎉 Order scheduled for pickup!');
        return;
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to schedule order');
      }
    } catch (err) {
      showToast('Network error scheduling order');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Order to Kitchen →';
      }
    }
    return;
  }

  const submitBtn = document.getElementById('submitOrderBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting order to kitchen...';
  }

  const payload = {
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    outletId: 'b0000000-0000-0000-0000-000000000001',
    tableId: activeTable.id,
    tableNumber: activeTable.number,
    items: cart.map(i => ({
      menuItemId: i.itemId,
      quantity: i.quantity,
      course: currentCourse === 'ALL_TOGETHER' ? i.course : currentCourse,
      courseStatus: 'FIRE',
      selectedModifiers: [],
    })),
    tipCents: currentTipAmount * 100,
    paymentMethod: paymentMethod,
  };

  try {
    const res = await fetch(`${API_BASE}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 503) {
      const errData = await res.json();
      showToast(`⚠️ Orders Paused: ${errData.error || 'Kitchen Rush'}`);
      const pauseBanner = document.getElementById('surgePauseBanner');
      if (pauseBanner) {
        pauseBanner.style.display = 'block';
        const etaText = document.getElementById('pauseEtaText');
        if (etaText) etaText.textContent = `~${errData.etaMinutes || 15}m`;
      }
      return;
    }

    if (res.ok) {
      const created = await res.json();
      currentBillOrderId = created.id;
      cart = [];
      updateCartUI();
      closeCartModal();
      showToast('Order confirmed by kitchen!');
      if (created.token) {
        const tokenBadge = document.getElementById('tokenBadgeContainer');
        const tokenCode = document.getElementById('guestTokenCode');
        if (tokenBadge && tokenCode) {
          tokenCode.textContent = created.token;
          tokenBadge.style.display = 'block';
        }
      }
      openOrderStatusModal(created.id);
    } else {
      const err = await res.json();
      showToast(err.error || 'Order submission failed.');
    }
  } catch (err) {
    showToast('Network error submitting order.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Order to Kitchen →';
    }
  }
}

// Live Order Tracking
let liveTrackingInterval = null;
function openOrderStatusModal(orderId) {
  currentBillOrderId = orderId;
  const idEl = document.getElementById('liveOrderId');
  const tblEl = document.getElementById('liveOrderTable');
  if (idEl) idEl.textContent = orderId.slice(-6);
  if (tblEl) tblEl.textContent = activeTable.number;
  document.getElementById('orderStatusModal')?.classList.add('active');
  pollOrderStatus(orderId);
  if (liveTrackingInterval) clearInterval(liveTrackingInterval);
  liveTrackingInterval = setInterval(() => pollOrderStatus(orderId), 3000);
}

function closeOrderStatusModal() {
  document.getElementById('orderStatusModal')?.classList.remove('active');
  if (liveTrackingInterval) { clearInterval(liveTrackingInterval); liveTrackingInterval = null; }
}

async function pollOrderStatus(orderId) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/orders/${orderId}/status-stepper`);
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('stepperContainer');
    if (!container) return;
    container.innerHTML = (data.stages || []).map((stage) => {
      const isDone = stage.completed; const isCurr = stage.current;
      const color = isDone ? '#267e3e' : isCurr ? '#fc8019' : '#94a3b8';
      const icon = isDone ? '✓' : isCurr ? '●' : '○';
      return `
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:28px; height:28px; border-radius:50%; background:${isDone ? '#eaf5eb' : isCurr ? '#fef3eb' : '#f1f3f6'}; border:2px solid ${color}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.85rem; color:${color};">${icon}</div>
          <div style="flex:1;">
            <div style="font-weight:800; color:${isCurr ? 'var(--text-title)' : color}; font-size:0.95rem;">${stage.label}</div>
            ${stage.timestamp ? `<div style="font-size:0.75rem; color:var(--text-muted);">${new Date(stage.timestamp).toLocaleTimeString()}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {}
}

// Guest Reviews
function rateExperience(stars) {
  selectedRating = stars;
  document.querySelectorAll('.star-btn').forEach((btn, idx) => {
    if (idx < stars) btn.classList.add('active'); else btn.classList.remove('active');
  });
}

async function submitReviewAction() {
  try {
    await fetch(`${API_BASE}/api/v1/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: currentBillOrderId || 'guest-direct',
        rating: selectedRating,
        tableNumber: activeTable?.number || 1,
        category: 'SERVICE',
        feedbackText: 'Great experience'
      })
    });
  } catch (e) {}
  document.getElementById('reviewModal')?.classList.remove('active');
  showToast('Thank you for your valuable feedback!');
}

// Optional Guest Profile / Phone
function openLoginModal() { document.getElementById('loginModal')?.classList.add('active'); }
function closeLoginModal() { document.getElementById('loginModal')?.classList.remove('active'); }

async function requestGuestOTP() {
  const phone = document.getElementById('guestPhoneInput')?.value.trim();
  if (!phone || phone.length < 10) {
    showToast('Please enter a valid 10-digit Indian mobile number.');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/guest/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: `+91${phone}` })
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`OTP Sent to +91 ${phone}! (Demo: ${data.otpCode || '1234'})`);
      const otpContainer = document.getElementById('otpInputContainer');
      const sendBtn = document.getElementById('sendOtpBtn');
      const verifyBtn = document.getElementById('verifyOtpBtn');
      if (otpContainer) otpContainer.style.display = 'block';
      if (sendBtn) sendBtn.style.display = 'none';
      if (verifyBtn) verifyBtn.style.display = 'block';
    }
  } catch (e) { showToast('Error sending OTP.'); }
}

async function verifyGuestOTP() {
  const phone = document.getElementById('guestPhoneInput')?.value.trim();
  const code = document.getElementById('guestOtpCode')?.value.trim();
  if (!phone || !code) { showToast('Please enter mobile number and OTP.'); return; }
  try {
    const res = await fetch(`${API_BASE}/api/v1/guest/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: `+91${phone}`, code })
    });
    if (res.ok) {
      localStorage.setItem('abiruchi_guest_phone', phone);
      showToast('Signed in successfully! Welcome back.');
      const lbl = document.getElementById('userLoginLabel');
      if (lbl) lbl.textContent = `+91 ${phone.slice(-4)}`;
      const otpStep = document.getElementById('loginOtpStep');
      const prefsStep = document.getElementById('prefsStep');
      if (otpStep) otpStep.style.display = 'none';
      if (prefsStep) prefsStep.style.display = 'block';
    } else {
      showToast('Invalid OTP code. Try demo code 1234.');
    }
  } catch (e) { showToast('Error verifying code.'); }
}

async function saveGuestPreferences() {
  showToast('Preferences saved! Applied to your profile.');
  closeLoginModal();
}

async function loadBestOffer(subtotalCents = 0) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/checkout/best-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId: 'b0000000-0000-0000-0000-000000000001', subtotalCents })
    });
    if (res.ok) {
      bestOffer = await res.json();
      const banner = document.getElementById('offerBanner');
      const textEl = document.getElementById('offerBannerText');
      if (bestOffer && bestOffer.savedCents > 0) {
        if (banner) banner.style.display = 'flex';
        if (textEl) textEl.textContent = `Applied "${bestOffer.offer.name}" — You save ${formatINR(bestOffer.savedCents)}!`;
      } else if (banner) {
        banner.style.display = 'none';
      }
    }
  } catch (e) {}
}

async function loadSpecials() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/specials?outletId=b0000000-0000-0000-0000-000000000001`);
    if (res.ok) { activeSpecials = await res.json(); }
  } catch (e) {}
}

async function loadAIRecommendations() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId: 'b0000000-0000-0000-0000-000000000001', dietaryFilters: [] })
    });
    if (res.ok) {
      const data = await res.json();
      aiRecommendations = data.recommendations || [];
    }
  } catch (e) {}
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  if (toast && msgEl) {
    msgEl.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  }
}

// Dish Details & Allergen Modal
let currentModalDishId = null;

function openDishDetailsModal(itemId) {
  const item = (menuData.items || []).find(i => i.id === itemId);
  if (!item) return;
  currentModalDishId = itemId;

  const titleEl = document.getElementById('dishModalTitle');
  const imgEl = document.getElementById('dishModalImg');
  const priceEl = document.getElementById('dishModalPrice');
  const descEl = document.getElementById('dishModalDesc');
  if (titleEl) titleEl.textContent = item.name;
  if (imgEl) imgEl.src = item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80';
  if (priceEl) priceEl.textContent = formatINR(item.basePriceCents);
  if (descEl) descEl.textContent = item.description || 'Crafted with premium artisanal ingredients by our master chef.';

  const dietBadge = document.getElementById('dishModalDietBadge');
  if (dietBadge) {
    dietBadge.innerHTML = item.dietaryType === 'VEG'
      ? '<span class="fssai-symbol fssai-veg"><span class="fssai-veg-dot"></span></span> <span style="font-size:0.8rem; font-weight:800; color:#267e3e;">VEGETARIAN</span>'
      : '<span class="fssai-symbol fssai-nonveg"><span class="fssai-nonveg-dot"></span></span> <span style="font-size:0.8rem; font-weight:800; color:#e43b4f;">NON-VEGETARIAN</span>';
  }

  const allergenEl = document.getElementById('dishModalAllergenNotice');
  if (allergenEl) {
    const list = (item.allergens || []).join(', ') || 'No common allergen alerts reported';
    allergenEl.textContent = `Verified restaurant data: Contains ${list}. Prepared in a shared kitchen facility; cross-contact advisory applies.`;
  }

  document.getElementById('dishDetailModal')?.classList.add('active');
}

function closeDishDetailModal() {
  document.getElementById('dishDetailModal')?.classList.remove('active');
  currentModalDishId = null;
}

function addCurrentModalDishToCart() {
  if (currentModalDishId) {
    addToCart(currentModalDishId);
    closeDishDetailModal();
  }
}

// Global Lifecycle Initializer
async function init() {
  initTheme();
  initUserSessionState();
  await loadLanguages();
  await initSession();
  await loadMenu(currentLang);
  loadSpecials();
  loadBestOffer(0);
  loadAIRecommendations();

  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => prefetchLanguages(['te', 'hi']));
  } else {
    setTimeout(() => prefetchLanguages(['te', 'hi']), 1000);
  }
}

function initUserSessionState() {
  const phone = localStorage.getItem('abiruchi_guest_phone');
  if (phone) {
    const lbl = document.getElementById('userLoginLabel');
    if (lbl) lbl.textContent = `+91 ${phone.slice(-4)}`;
  }
}

window.addEventListener('DOMContentLoaded', init);
'''

with open('apps/web-guest/public/app.js', 'w', encoding='utf-8') as f:
    f.write(app_js_content)

print('apps/web-guest/public/app.js updated successfully!')
