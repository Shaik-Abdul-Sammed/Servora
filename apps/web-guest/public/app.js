// Abiruchi Hotel Guest SPA — Intelligent Dining & Table Operating System
const API_BASE = window.location.origin;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;
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
let currentShiftFilter = 'ALL';
let currentCategoryFilter = null;
let currentSearchQuery = '';
let currentSortOrder = 'DEFAULT';
let currentViewMode = localStorage.getItem('abiruchi_view_mode') || 'grid';
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
    recommended: 'Recommended',
    signIn: 'Sign In',
    logOut: 'Sign Out',
    reserve: 'Book Table',
    orders: 'My Orders',
    changeTable: 'Change Table',
    viewCartProceed: 'VIEW CART & PAY',
    payNow: 'Pay Bill / Prepay via UPI',
    tableConfirmTitle: 'Table {num} • Confirmed',
    tableConfirmSubtitle: '🟢 Available & Ready • Dine-In Session Active',
    takeawayTitle: 'Takeaway / Parcel Pickup',
    takeawaySubtitle: '🛍️ Counter Collection • Active Session',
    allDishes: 'All',
    pureVeg: 'Veg',
    nonVeg: 'Non-Veg',
    bestseller: '⭐ Bestseller',
    glutenFree: '🌾 Gluten-Free',
    shiftNow: '⚡ Serving Now',
    shiftBreakfast: '🌅 Breakfast',
    shiftLunch: '☀️ Lunch',
    shiftSnacks: '☕ Snacks & Tea',
    shiftDinner: '🌙 Dinner',
    shiftAll: '✨ All Items',
    sortPopular: '⭐ Most Popular',
    sortLowHigh: '💰 Price: Low to High',
    sortHighLow: '💎 Price: High to Low',
    tableSelectorTitle: '📍 Confirm Your Dining Table',
    tableSelectorSubtitle: 'Select your table number below or choose Takeaway / Parcel. Orders will be delivered directly to your chosen table.'
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
    recommended: 'సిఫార్సు చేయబడినవి',
    signIn: 'లాగిన్',
    logOut: 'లాగ్ అవుట్',
    reserve: 'టేబుల్ బుకింగ్',
    orders: 'నా ఆర్డర్లు',
    changeTable: 'టేబుల్ మార్చండి',
    viewCartProceed: 'కార్ట్ చూసి చెల్లించండి',
    payNow: 'యూపీఐ ద్వారా బిల్లు చెల్లించండి',
    tableConfirmTitle: 'టేబుల్ {num} • నిర్ధారించబడింది',
    tableConfirmSubtitle: '🟢 అందుబాటులో ఉంది • డైన్-ఇన్ సెషన్ యాక్టివ్',
    takeawayTitle: 'పార్సెల్ / టేక్‌అవే పికప్',
    takeawaySubtitle: '🛍️ కౌంటర్ సేకరణ • యాక్టివ్ సెషన్',
    allDishes: 'అన్నీ',
    pureVeg: 'శాఖాహారం',
    nonVeg: 'మాంసాహారం',
    bestseller: '⭐ బెస్ట్ సెల్లర్',
    glutenFree: '🌾 గ్లూటెన్-ఫ్రీ',
    shiftNow: '⚡ ఇప్పుడు లభించేవి',
    shiftBreakfast: '🌅 టిఫిన్',
    shiftLunch: '☀️ మధ్యాహ్న భోజనం',
    shiftSnacks: '☕ సాయంత్రం స్నాక్స్',
    shiftDinner: '🌙 రాత్రి భోజనం',
    shiftAll: '✨ అన్ని వంటకాలు',
    sortPopular: '⭐ అత్యంత ప్రజాదరణ',
    sortLowHigh: '💰 ధర: తక్కువ నుండి ఎక్కువ',
    sortHighLow: '💎 ధర: ఎక్కువ నుండి తక్కువ',
    tableSelectorTitle: '📍 మీ భోజన టేబుల్‌ను నిర్ధారించండి',
    tableSelectorSubtitle: 'క్రింద మీ టేబుల్ నంబర్‌ను ఎంచుకోండి లేదా పార్సెల్ ఎంచుకోండి. ఆర్డర్లు నేరుగా మీ టేబుల్‌కు వస్తాయి.'
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
    recommended: 'अनुशंसित',
    signIn: 'साइन इन',
    logOut: 'लॉग आउट',
    reserve: 'टेबल बुक करें',
    orders: 'मेरे ऑर्डर',
    changeTable: 'टेबल बदलें',
    viewCartProceed: 'कार्ट देखें और भुगतान करें',
    payNow: 'यूपीआई से बिल का भुगतान करें',
    tableConfirmTitle: 'टेबल {num} • पुष्टि की गई',
    tableConfirmSubtitle: '🟢 उपलब्ध और तैयार • डाइन-इन सत्र सक्रिय',
    takeawayTitle: 'टेकअवे / पार्सल पिकअप',
    takeawaySubtitle: '🛍️ काउंटर संग्रह • सक्रिय सत्र',
    allDishes: 'सभी',
    pureVeg: 'शाकाहारी',
    nonVeg: 'मांसाहारी',
    bestseller: '⭐ सर्वाधिक बिकने वाला',
    glutenFree: '🌾 ग्लूटेन-मुक्त',
    shiftNow: '⚡ अभी उपलब्ध',
    shiftBreakfast: '🌅 नाश्ता',
    shiftLunch: '☀️ दोपहर का भोजन',
    shiftSnacks: '☕ नाश्ता और चाय',
    shiftDinner: '🌙 रात का भोजन',
    shiftAll: '✨ सभी व्यंजन',
    sortPopular: '⭐ सबसे लोकप्रिय',
    sortLowHigh: '💰 कीमत: कम से ज्यादा',
    sortHighLow: '💎 कीमत: ज्यादा से कम',
    tableSelectorTitle: '📍 अपनी डाइनिंग टेबल की पुष्टि करें',
    tableSelectorSubtitle: 'नीचे अपना टेबल नंबर चुनें या पार्सल चुनें। ऑर्डर सीधे आपकी चुनी हुई टेबल पर पहुंचाए जाएंगे।'
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

function setTheme(theme) {
  applyTheme(theme);
}
window.setTheme = setTheme;

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('abiruchi_theme', theme);

  let activeMode = theme;
  if (theme === 'system') {
    activeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', activeMode);
  document.body?.setAttribute('data-theme', activeMode);

  // Sync button active states
  const btnLight = document.getElementById('btnThemeLight');
  const btnDark = document.getElementById('btnThemeDark');
  const btnSystem = document.getElementById('btnThemeSystem');
  if (btnLight) btnLight.classList.toggle('active', theme === 'light');
  if (btnDark) btnDark.classList.toggle('active', theme === 'dark');
  if (btnSystem) btnSystem.classList.toggle('active', theme === 'system');

  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.textContent = activeMode === 'dark' ? '☀️' : '🌙';
    themeBtn.title = `Current: ${activeMode.toUpperCase()} (Click to toggle)`;
  }
}
window.applyTheme = applyTheme;

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}
window.toggleTheme = toggleTheme;

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

  if (document.getElementById('changeTableBtnLabel')) document.getElementById('changeTableBtnLabel').textContent = dict.changeTable || 'Change Table';
  if (document.getElementById('floatingCartProceedText')) document.getElementById('floatingCartProceedText').textContent = dict.viewCartProceed || 'VIEW CART & PAY';
  if (document.getElementById('tableSelectorTitle')) document.getElementById('tableSelectorTitle').textContent = dict.tableSelectorTitle || '📍 Confirm Your Dining Table';
  if (document.getElementById('tableSelectorSubtitle')) document.getElementById('tableSelectorSubtitle').textContent = dict.tableSelectorSubtitle || 'Select your table number below or choose Takeaway / Parcel.';

  // Shifts translation
  if (document.getElementById('shiftChipNow')) document.getElementById('shiftChipNow').textContent = dict.shiftNow || '⚡ Serving Now';
  if (document.getElementById('shiftChipBreakfast')) document.getElementById('shiftChipBreakfast').textContent = dict.shiftBreakfast || '🌅 Breakfast';
  if (document.getElementById('shiftChipLunch')) document.getElementById('shiftChipLunch').textContent = dict.shiftLunch || '☀️ Lunch';
  if (document.getElementById('shiftChipSnacks')) document.getElementById('shiftChipSnacks').textContent = dict.shiftSnacks || '☕ Snacks & Tea';
  if (document.getElementById('shiftChipDinner')) document.getElementById('shiftChipDinner').textContent = dict.shiftDinner || '🌙 Dinner';
  if (document.getElementById('shiftChipAll')) document.getElementById('shiftChipAll').textContent = dict.shiftAll || '✨ All Items';

  // Dietary filters translation
  const filterAll = document.querySelector('#filterAllBtn span');
  if (filterAll) filterAll.textContent = dict.allDishes || 'All';
  const filterVeg = document.querySelector('#filterVegBtn span:last-child');
  if (filterVeg) filterVeg.textContent = dict.pureVeg || 'Veg';
  const filterNonVeg = document.querySelector('#filterNonVegBtn span:last-child');
  if (filterNonVeg) filterNonVeg.textContent = dict.nonVeg || 'Non-Veg';
  const filterBestseller = document.querySelector('#filterBestsellerBtn span');
  if (filterBestseller) filterBestseller.textContent = dict.bestseller || '⭐ Bestseller';

  // Update table confirmation UI with translated strings
  if (typeof updateTableConfirmationUI === 'function') {
    updateTableConfirmationUI();
  }

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
  const pathMatch = window.location.pathname.match(/\/(?:table|t|dine)\/([a-zA-Z0-9_-]+)/i);
  const pathTable = pathMatch ? pathMatch[1] : null;
  const urlTable = urlParams.get('table') || urlParams.get('t') || urlParams.get('tableId') || urlParams.get('tableNumber') || pathTable;

  if (urlTable) {
    if (urlTable.toLowerCase() === 'takeaway' || urlTable.toLowerCase() === 'token') {
      activeTable = { id: 'takeaway', number: 'Takeaway' };
    } else {
      activeTable = { id: `table-${urlTable}`, number: String(urlTable) };
    }
    localStorage.setItem('abiruchi_table_num', activeTable.number);
  } else {
    const savedTable = localStorage.getItem('abiruchi_table_num');
    if (savedTable) {
      activeTable = { id: savedTable === 'Takeaway' ? 'takeaway' : `table-${savedTable}`, number: savedTable };
    }
  }

  const tableId = urlParams.get('tableId') || activeTable.id;

  if (mode === 'BOOKING') {
    window.location.href = '/booking';
    return;
  }
  if (mode === 'TOKEN' || activeTable.number === 'Takeaway') {
    const tableBadge = document.getElementById('tableBadgeContainer');
    if (tableBadge) tableBadge.innerHTML = '<span style="font-size:0.75rem; font-weight:800; color:var(--primary);">🎟️ Takeaway Mode</span>';
  } else if (mode === 'MENU_ONLY') {
    const tableBadge = document.getElementById('tableBadgeContainer');
    if (tableBadge) tableBadge.innerHTML = '<span style="font-size:0.75rem; font-weight:800; color:var(--primary);">📖 Digital Menu</span>';
  }

  updateTableConfirmationUI();

  try {
    const query = token ? `token=${token}` : `tableId=${tableId}`;
    const res = await fetch(`${API_BASE}/api/v1/qr/session?${query}`);
    if (res.status === 410) {
      const banner = document.getElementById('qrInactiveBanner');
      if (banner) banner.style.display = 'block';
      const menuContainer = document.getElementById('menuContainer');
      if (menuContainer) menuContainer.style.opacity = '0.4';
      return;
    }
    if (res.ok) {
      const session = await res.json();
      if (session.table && mode !== 'TOKEN' && mode !== 'MENU_ONLY' && !urlTable) {
        activeTable = { id: session.table.id, number: session.table.tableNumber };
        localStorage.setItem('abiruchi_table_num', String(activeTable.number));
        updateTableConfirmationUI();
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

// ==========================================================================
// Scroll Lock Helper for Modals & Sheets
// ==========================================================================
function lockBodyScroll() {
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
}
function unlockBodyScroll() {
  const anyActive = document.querySelector('.sheet-overlay.active, .voice-modal-overlay[style*="flex"], .history-modal-overlay[style*="flex"]');
  if (!anyActive) {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }
}
window.lockBodyScroll = lockBodyScroll;
window.unlockBodyScroll = unlockBodyScroll;

function pushModalState(modalId) {
  if (typeof window !== 'undefined' && window.history && window.history.pushState) {
    if (!window.history.state || window.history.state.modalId !== modalId) {
      window.history.pushState({ modalId: modalId, timestamp: Date.now() }, '');
    }
  }
}
function popModalState(modalId) {
  if (typeof window !== 'undefined' && window.history && window.history.state && window.history.state.modalId === modalId) {
    window.history.back();
  }
}
window.pushModalState = pushModalState;
window.popModalState = popModalState;

// ==========================================================================
// Table Selection and Availability Management (URL Entry & Real-Time)
// ==========================================================================
function openTableSelectorModal() {
  renderTableGrid();
  document.getElementById('tableSelectorModal')?.classList.add('active');
  lockBodyScroll();
  pushModalState('tableSelectorModal');
}
window.openTableSelectorModal = openTableSelectorModal;

function closeTableSelectorModal() {
  document.getElementById('tableSelectorModal')?.classList.remove('active');
  unlockBodyScroll();
  popModalState('tableSelectorModal');
}
window.closeTableSelectorModal = closeTableSelectorModal;

function renderTableGrid() {
  const grid = document.getElementById('tableGridContainer');
  if (!grid) return;
  const currentNum = String(activeTable?.number || '14');
  let html = '';
  for (let i = 1; i <= 20; i++) {
    const isSelected = currentNum === String(i);
    html += `
      <button type="button" class="opt-pill ${isSelected ? 'active' : ''}"
        onclick="selectTableOption('TABLE', '${i}')"
        style="padding:10px 4px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:3px; border-radius:10px; cursor:pointer;">
        <span style="font-size:1.1rem;">🪑</span>
        <span style="font-weight:900; font-size:0.85rem;">Table ${i}</span>
        <span style="font-size:0.65rem; color:${isSelected ? 'var(--primary)' : '#16a34a'}; font-weight:700;">
          ${isSelected ? '✓ Selected' : '🟢 Free'}
        </span>
      </button>
    `;
  }
  grid.innerHTML = html;
}
window.renderTableGrid = renderTableGrid;

function selectTableOption(mode, tableNumber) {
  if (mode === 'TOKEN' || tableNumber === 'Takeaway') {
    activeTable = { id: 'takeaway', number: 'Takeaway' };
    localStorage.setItem('abiruchi_table_num', 'Takeaway');
    showToast('🛍️ Takeaway / Parcel mode selected');
  } else {
    activeTable = { id: `table-${tableNumber}`, number: String(tableNumber) };
    localStorage.setItem('abiruchi_table_num', String(tableNumber));
    showToast(`📍 Table ${tableNumber} confirmed!`);
  }
  updateTableConfirmationUI();
  closeTableSelectorModal();
}
window.selectTableOption = selectTableOption;

function updateTableConfirmationUI() {
  const dict = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS.en;
  const badge = document.getElementById('tableBadge');
  const titleEl = document.getElementById('tableConfirmationTitle');
  const subtitleEl = document.getElementById('tableConfirmationSubtitle');
  const num = activeTable?.number || '14';

  if (num === 'Takeaway') {
    if (badge) badge.textContent = '🛍️ Takeaway';
    if (titleEl) titleEl.textContent = dict.takeawayTitle || 'Takeaway / Parcel Pickup';
    if (subtitleEl) subtitleEl.textContent = dict.takeawaySubtitle || '🛍️ Counter Collection • Active Session';
  } else {
    if (badge) badge.textContent = `Table ${num}`;
    if (titleEl) titleEl.textContent = (dict.tableConfirmTitle || 'Table {num} • Confirmed').replace('{num}', num);
    if (subtitleEl) subtitleEl.textContent = dict.tableConfirmSubtitle || '🟢 Available & Ready • Dine-In Session Active';
  }
}
window.updateTableConfirmationUI = updateTableConfirmationUI;

function loadCachedMenuImmediately() {
  try {
    const raw = localStorage.getItem('abiruchi_cached_menu_' + currentLang);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
        menuData = cached;
        filteredItems = [...cached.items];
        applyInvisibleLanguageStyles(currentLang, cached.dir || 'ltr');
        renderCategories();
        renderMenu();
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
  // Check localStorage for 0ms initial render if memory cache missed
  try {
    const raw = localStorage.getItem('abiruchi_cached_menu_' + lang);
    if (raw) {
      const localCached = JSON.parse(raw);
      if (localCached && Array.isArray(localCached.items) && localCached.items.length > 0) {
        menuCacheByLang.set(lang, localCached);
        if (!menuData || !menuData.items || menuData.items.length === 0) {
          menuData = localCached;
          filteredItems = [...localCached.items];
          applyInvisibleLanguageStyles(lang, localCached.dir || 'ltr');
          renderCategories();
          renderMenu();
        }
      }
    }
  } catch (e) {}

  try {
    const url = lang === 'en' ? `${API_BASE}/api/v1/menu` : `${API_BASE}/api/v1/menu?lang=${encodeURIComponent(lang)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      menuCacheByLang.set(lang, data);
      try {
        localStorage.setItem('abiruchi_cached_menu_' + lang, JSON.stringify(data));
      } catch (e) {}
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

function getCategoryIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('tiffin') || n.includes('breakfast') || n.includes('dosa') || n.includes('idli')) return '🥞';
  if (n.includes('lunch') || n.includes('meal') || n.includes('thali') || n.includes('biryani')) return '🍛';
  if (n.includes('dinner') || n.includes('curry') || n.includes('roti') || n.includes('parotta')) return '🌙';
  if (n.includes('snack') || n.includes('starter') || n.includes('bajji') || n.includes('samosa')) return '🥟';
  if (n.includes('drink') || n.includes('beverage') || n.includes('water') || n.includes('juice') || n.includes('soda')) return '🥤';
  if (n.includes('dessert') || n.includes('sweet')) return '🍨';
  return '🍽️';
}
window.getCategoryIcon = getCategoryIcon;

function renderCategories() {
  const nav = document.getElementById('categoryNav');
  if (!nav || !menuData.categories) return;
  const dict = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS.en;
  const isAllActive = !currentCategoryFilter;
  let html = `<button type="button" class="cat-btn ${isAllActive ? 'active' : ''}" data-cat-id="" onclick="filterCategory(null, this)">✨ ${dict.allDishes || 'All'}</button>`;
  for (const cat of menuData.categories) {
    const isCatActive = currentCategoryFilter === cat.id;
    const catIcon = getCategoryIcon(cat.name);
    html += `<button type="button" class="cat-btn ${isCatActive ? 'active' : ''}" data-cat-id="${cat.id}" onclick="filterCategory('${cat.id}', this)">${catIcon} ${cat.name}</button>`;
  }
  nav.innerHTML = html;
}

function filterCategory(catId, btnEl) {
  currentCategoryFilter = catId || null;
  document.querySelectorAll('.cat-btn').forEach(b => {
    const bCatId = b.getAttribute('data-cat-id');
    if ((!catId && !bCatId) || (catId && bCatId === catId)) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
  renderMenu();
}
window.filterCategory = filterCategory;

function applyDietaryFilter(diet, btnEl) {
  currentDietaryFilter = diet || 'ALL';
  try {
    localStorage.setItem('abiruchi_guest_diet', currentDietaryFilter);
  } catch (e) {}

  const select = document.getElementById('dietaryFilterSelect');
  if (select && select.value !== currentDietaryFilter) {
    select.value = currentDietaryFilter;
  }

  document.querySelectorAll('.abiruchi-pill-toggle').forEach(b => {
    b.classList.remove('active', 'active-veg', 'active-nonveg');
  });

  if (currentDietaryFilter === 'ALL') {
    document.getElementById('filterAllBtn')?.classList.add('active');
  } else if (currentDietaryFilter === 'VEG') {
    document.getElementById('filterVegBtn')?.classList.add('active-veg');
  } else if (currentDietaryFilter === 'NON_VEG') {
    document.getElementById('filterNonVegBtn')?.classList.add('active-nonveg');
  } else if (currentDietaryFilter === 'BESTSELLER') {
    document.getElementById('filterBestsellerBtn')?.classList.add('active');
  } else if (currentDietaryFilter === 'GLUTEN_FREE') {
    document.getElementById('filterGlutenFreeBtn')?.classList.add('active');
  }

  renderMenu();
}
window.applyDietaryFilter = applyDietaryFilter;

function toggleDietFilter(filter, btnEl) {
  applyDietaryFilter(filter, btnEl);
}
window.toggleDietFilter = toggleDietFilter;

function handleSearch(query) {
  currentSearchQuery = (query || '').trim();
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) {
    clearBtn.style.display = currentSearchQuery.length > 0 ? 'block' : 'none';
  }
  renderMenu();
}
window.handleSearch = handleSearch;

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  currentSearchQuery = '';
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderMenu();
}
window.clearSearch = clearSearch;

function clearAllFilters() {
  currentCategoryFilter = null;
  currentSearchQuery = '';
  currentDietaryFilter = 'ALL';
  currentShiftFilter = 'ALL';
  currentSortOrder = 'DEFAULT';

  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) clearBtn.style.display = 'none';

  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', !b.getAttribute('data-cat-id'));
  });

  const dietSelect = document.getElementById('dietaryFilterSelect');
  if (dietSelect) dietSelect.value = 'ALL';
  document.querySelectorAll('.abiruchi-pill-toggle').forEach(b => b.classList.remove('active', 'active-veg', 'active-nonveg'));
  document.getElementById('filterAllBtn')?.classList.add('active');

  const shiftSelect = document.getElementById('shiftFilterSelect');
  if (shiftSelect) shiftSelect.value = 'ALL';
  document.querySelectorAll('.shift-chip').forEach(c => c.classList.remove('active'));

  const sortSelect = document.getElementById('menuSortSelect');
  if (sortSelect) sortSelect.value = 'DEFAULT';

  renderMenu();
}
window.clearAllFilters = clearAllFilters;

// ==========================================================================
// Time-Based Shift and Food Availability Helpers (Phase 2 UX)
// ==========================================================================
function getCurrentTimeMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

function timeStringToMinutes(str) {
  if (!str) return 0;
  const parts = str.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

function isItemAvailableNow(item, d = new Date()) {
  const currentMins = getCurrentTimeMinutes(d);
  const fromMins = timeStringToMinutes(item.servingFrom || '06:00');
  const untilMins = timeStringToMinutes(item.servingUntil || '23:30');
  return currentMins >= fromMins && currentMins <= untilMins;
}

function formatShiftTime(str) {
  if (!str) return '';
  const parts = str.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function updateLiveClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;

  const clockEl = document.getElementById('clockText');
  if (clockEl) clockEl.textContent = timeStr;

  const currentMins = getCurrentTimeMinutes(now);
  let shiftName = 'All Day';
  if (currentMins >= 360 && currentMins < 690) { // 06:00 - 11:30
    shiftName = 'Breakfast';
  } else if (currentMins >= 660 && currentMins < 990) { // 11:00 - 16:30
    shiftName = 'Lunch';
  } else if (currentMins >= 900 && currentMins < 1380) { // 15:00 - 23:00
    shiftName = currentMins >= 1080 ? 'Dinner' : 'Snacks & Tea';
  } else {
    shiftName = 'Late Night';
  }

  const shiftEl = document.getElementById('currentShiftText');
  if (shiftEl) shiftEl.textContent = shiftName;
}

function filterByShift(shiftKey, btn) {
  currentShiftFilter = shiftKey || 'ALL';
  const select = document.getElementById('shiftFilterSelect');
  if (select && select.value !== currentShiftFilter) select.value = currentShiftFilter;
  document.querySelectorAll('.shift-chip').forEach(c => c.classList.remove('active'));
  if (btn && btn.classList) btn.classList.add('active');
  renderMenu();
}
window.filterByShift = filterByShift;

function applyMenuSort(sortKey) {
  currentSortOrder = sortKey || 'DEFAULT';
  const select = document.getElementById('menuSortSelect');
  if (select && select.value !== currentSortOrder) select.value = currentSortOrder;
  renderMenu();
}
window.applyMenuSort = applyMenuSort;

function setViewMode(mode) {
  currentViewMode = mode;
  try {
    localStorage.setItem('abiruchi_view_mode', mode);
  } catch (e) {}
  const btnGrid = document.getElementById('btnViewGrid');
  const btnList = document.getElementById('btnViewList');
  if (btnGrid && btnList) {
    btnGrid.classList.toggle('active', mode === 'grid');
    btnList.classList.toggle('active', mode === 'list');
  }
  renderMenu();
}
window.setViewMode = setViewMode;

// ==========================================================================
// Unified Dish Filtering Engine
// ==========================================================================
function getFilteredDishes() {
  if (!menuData || !Array.isArray(menuData.items)) return [];
  const now = new Date();
  let list = [...menuData.items];

  // 1. Category Filter
  if (currentCategoryFilter) {
    list = list.filter(i => i.categoryId === currentCategoryFilter);
  }

  // 2. Search Query (dish name, description, tags, category name)
  if (currentSearchQuery) {
    const q = currentSearchQuery.toLowerCase();
    list = list.filter(i => {
      const matchName = i.name && i.name.toLowerCase().includes(q);
      const matchDesc = i.description && i.description.toLowerCase().includes(q);
      const matchTags = Array.isArray(i.tags) && i.tags.some(t => t.toLowerCase().includes(q));
      const cat = (menuData.categories || []).find(c => c.id === i.categoryId);
      const matchCat = cat && cat.name && cat.name.toLowerCase().includes(q);
      return matchName || matchDesc || matchTags || matchCat;
    });
  }

  // 3. Dietary Filter
  if (currentDietaryFilter === 'VEG') {
    list = list.filter(i => i.dietaryType === 'VEG');
  } else if (currentDietaryFilter === 'NON_VEG') {
    list = list.filter(i => i.dietaryType === 'NON_VEG' || !i.dietaryType);
  } else if (currentDietaryFilter === 'BESTSELLER') {
    list = list.filter(i => (i.tags && i.tags.includes('bestseller')) || i.basePriceCents > 8000);
  } else if (currentDietaryFilter === 'GLUTEN_FREE') {
    list = list.filter(i => !(i.allergens || []).includes('GLUTEN'));
  }

  // 4. Shift & Daypart Filter
  if (currentShiftFilter === 'NOW') {
    const availableNow = list.filter(i => isItemAvailableNow(i, now));
    if (availableNow.length > 0) {
      list = availableNow;
    }
  } else if (currentShiftFilter === 'BREAKFAST') {
    list = list.filter(i => {
      const from = timeStringToMinutes(i.servingFrom || '06:00');
      const until = timeStringToMinutes(i.servingUntil || '11:30');
      return from <= 690 && until >= 360;
    });
  } else if (currentShiftFilter === 'LUNCH') {
    list = list.filter(i => {
      const from = timeStringToMinutes(i.servingFrom || '11:00');
      const until = timeStringToMinutes(i.servingUntil || '16:30');
      return from <= 990 && until >= 660;
    });
  } else if (currentShiftFilter === 'SNACKS') {
    list = list.filter(i => {
      const from = timeStringToMinutes(i.servingFrom || '15:00');
      const until = timeStringToMinutes(i.servingUntil || '23:00');
      return from <= 1380 && until >= 900;
    });
  } else if (currentShiftFilter === 'DINNER') {
    list = list.filter(i => {
      const from = timeStringToMinutes(i.servingFrom || '18:00');
      const until = timeStringToMinutes(i.servingUntil || '23:59');
      return from <= 1439 && until >= 1080;
    });
  }

  // 5. Cost and Popularity Sorting
  if (currentSortOrder === 'PRICE_ASC') {
    list.sort((a, b) => a.basePriceCents - b.basePriceCents);
  } else if (currentSortOrder === 'PRICE_DESC') {
    list.sort((a, b) => b.basePriceCents - a.basePriceCents);
  } else if (currentSortOrder === 'NAME_ASC') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (currentSortOrder === 'PREP_TIME') {
    list.sort((a, b) => (a.prepTimeMinutes || 15) - (b.prepTimeMinutes || 15));
  } else if (currentSortOrder === 'DEFAULT') {
    list.sort((a, b) => {
      const aBest = (a.tags && a.tags.includes('bestseller')) ? 1 : 0;
      const bBest = (b.tags && b.tags.includes('bestseller')) ? 1 : 0;
      return bBest - aBest;
    });
  }

  return list;
}

// ==========================================================================
// Dish Card Presentation (Compact Grid & List Card)
// ==========================================================================
function renderDishCard(item, now, mode, catMap) {
  const cartItem = cart.find(ci => ci.itemId === item.id);
  const qty = cartItem ? cartItem.quantity : 0;
  const isVeg = item.dietaryType === 'VEG';
  const availableNow = isItemAvailableNow(item, now);
  const cat = catMap ? catMap.get(item.categoryId) : null;
  const catName = cat ? cat.name : '';
  const catIcon = catName ? getCategoryIcon(catName) : '🍽️';

  let photoUrl = (item.imageUrl && !item.imageUrl.includes('photo-1546069901-ba9599a7e63c'))
    ? item.imageUrl
    : (window.getAutoDishPhoto ? window.getAutoDishPhoto(item.name, item.categoryId) : 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=360&q=75&auto=format');
  if (photoUrl && photoUrl.includes('images.unsplash.com')) {
    photoUrl = photoUrl.replace(/w=\d+/, 'w=360').replace(/q=\d+/, 'q=75');
  }

  if (mode === 'grid') {
    return `
      <div class="grid-dish-card" onclick="openDishDetailsModal('${item.id}')">
        <div class="grid-dish-media">
          <img src="${photoUrl}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" class="grid-dish-img"
               onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=360&q=75&auto=format';" />
          <div style="position:absolute; top:6px; left:6px; background:rgba(0,0,0,0.65); padding:2px 4px; border-radius:4px; display:flex; align-items:center;">
            <span class="fssai-symbol ${isVeg ? 'fssai-veg' : 'fssai-nonveg'}">
              <span class="${isVeg ? 'fssai-veg-dot' : 'fssai-nonveg-dot'}"></span>
            </span>
          </div>
          ${item.tags && item.tags.includes('bestseller') ? `
            <span style="position:absolute; top:6px; right:6px; background:#fc8019; color:#fff; font-size:0.6rem; font-weight:900; padding:2px 5px; border-radius:4px;">★ Best</span>
          ` : ''}
        </div>

        <div class="grid-dish-body">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; margin-bottom:4px;">
              ${catName ? `<span class="dish-cat-pill">${catIcon} ${catName}</span>` : ''}
              <span class="time-badge ${availableNow ? 'now' : 'future'}">
                ${availableNow ? '✓ Available' : `⏰ ${formatShiftTime(item.servingFrom)}`}
              </span>
            </div>
            <div class="grid-dish-title" title="${item.name}">${item.name}</div>
          </div>

          <div class="grid-dish-bottom">
            <span class="grid-dish-price">${formatINR(item.basePriceCents)}</span>
            <div onclick="event.stopPropagation()">
              ${qty === 0 ? `
                <button type="button" class="grid-dish-btn-add" aria-label="Add ${escapeHtml(item.name)} to cart" onclick="addToCart('${item.id}')">ADD +</button>
              ` : `
                <div class="grid-dish-stepper">
                  <span style="cursor:pointer; padding:0 4px;" onclick="removeFromCart('${item.id}')">−</span>
                  <span>${qty}</span>
                  <span style="cursor:pointer; padding:0 4px;" onclick="addToCart('${item.id}')">+</span>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>`;
  } else {
    return `
      <div class="abiruchi-dish-card" onclick="openDishDetailsModal('${item.id}')">
        <div class="abiruchi-dish-info">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="fssai-symbol ${isVeg ? 'fssai-veg' : 'fssai-nonveg'}">
              <span class="${isVeg ? 'fssai-veg-dot' : 'fssai-nonveg-dot'}"></span>
            </span>
            ${catName ? `<span class="dish-cat-pill">${catIcon} ${catName}</span>` : ''}
            <span class="time-badge ${availableNow ? 'now' : 'future'}">
              ${availableNow ? '✓ Available Now' : `⏰ Serving at ${formatShiftTime(item.servingFrom)}`}
            </span>
            ${item.tags && item.tags.includes('bestseller') ? '<span class="abiruchi-dish-tag">★ Bestseller</span>' : ''}
          </div>
          <div class="abiruchi-dish-name">${item.name}</div>
          <div class="abiruchi-dish-price">${formatINR(item.basePriceCents)}</div>
          <div class="abiruchi-dish-desc">${item.description || ''}</div>
        </div>

        <div class="abiruchi-dish-media" onclick="event.stopPropagation()">
          <img src="${photoUrl}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" class="abiruchi-dish-img"
               onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=360&q=75&auto=format';" />

          <div class="abiruchi-btn-wrapper">
            ${qty === 0 ? `
              <button type="button" class="abiruchi-btn-add" aria-label="Add ${escapeHtml(item.name)} to cart" onclick="addToCart('${item.id}'); event.stopPropagation();">
                ADD <span style="font-size:0.8rem; font-weight:900; margin-left:2px;">+</span>
              </button>
            ` : `
              <div class="abiruchi-qty-stepper">
                <button type="button" class="abiruchi-step-btn" aria-label="Decrease quantity" onclick="removeFromCart('${item.id}'); event.stopPropagation();">−</button>
                <span class="abiruchi-qty-num">${qty}</span>
                <button type="button" class="abiruchi-step-btn" aria-label="Increase quantity" onclick="addToCart('${item.id}'); event.stopPropagation();">+</button>
              </div>
            `}
          </div>
        </div>
      </div>`;
  }
}

// ==========================================================================
// Abiruchi Hotel Food Presentation (Categorized Sections with Quick Directory)
// ==========================================================================
function renderMenu() {
  const container = document.getElementById('menuContainer');
  if (!container) return;

  const now = new Date();
  const displayList = getFilteredDishes();
  filteredItems = displayList;

  // Update item count indicator
  const countEl = document.getElementById('menuItemCount');
  if (countEl) countEl.textContent = displayList.length;

  const catMap = new Map();
  for (const c of (menuData.categories || [])) {
    catMap.set(c.id, c);
  }

  // Build Active Filters Summary HTML
  const hasActiveFilter = Boolean(currentCategoryFilter || currentSearchQuery || (currentDietaryFilter && currentDietaryFilter !== 'ALL') || (currentShiftFilter && currentShiftFilter !== 'ALL'));
  let activeFiltersHtml = '';
  if (hasActiveFilter) {
    const filterChips = [];
    if (currentCategoryFilter && catMap.has(currentCategoryFilter)) {
      const c = catMap.get(currentCategoryFilter);
      filterChips.push(`<span class="active-filter-chip">📂 ${c.name} <span class="active-filter-chip-remove" onclick="filterCategory(null)" title="Remove category filter">✕</span></span>`);
    }
    if (currentSearchQuery) {
      filterChips.push(`<span class="active-filter-chip">🔍 "${escapeHtml(currentSearchQuery)}" <span class="active-filter-chip-remove" onclick="clearSearch()" title="Clear search">✕</span></span>`);
    }
    if (currentDietaryFilter && currentDietaryFilter !== 'ALL') {
      const dietLabels = { VEG: '🟢 Pure Veg', NON_VEG: '🔴 Non-Veg', BESTSELLER: '⭐ Bestsellers', GLUTEN_FREE: '🌾 Gluten-Free' };
      filterChips.push(`<span class="active-filter-chip">${dietLabels[currentDietaryFilter] || currentDietaryFilter} <span class="active-filter-chip-remove" onclick="applyDietaryFilter('ALL')" title="Clear dietary filter">✕</span></span>`);
    }
    if (currentShiftFilter && currentShiftFilter !== 'ALL') {
      const shiftLabels = { NOW: '⏰ Available Now', BREAKFAST: '🌅 Breakfast', LUNCH: '🍛 Lunch', SNACKS: '☕ Snacks', DINNER: '🌙 Dinner' };
      filterChips.push(`<span class="active-filter-chip">${shiftLabels[currentShiftFilter] || currentShiftFilter} <span class="active-filter-chip-remove" onclick="filterByShift('ALL')" title="Show all shifts">✕</span></span>`);
    }

    activeFiltersHtml = `
      <div class="active-filters-summary">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span style="font-weight:800; color:var(--text-title); font-size:0.78rem;">Active Filters:</span>
          ${filterChips.join('')}
        </div>
        <button type="button" class="btn-reset-filters" onclick="clearAllFilters()">
          ✕ Reset All Filters
        </button>
      </div>`;
  }

  // Handle empty state
  if (displayList.length === 0) {
    container.className = 'menu-container';
    container.innerHTML = `
      ${activeFiltersHtml}
      <div style="text-align:center; padding:48px 16px; color:var(--text-muted); grid-column:1/-1;">
        <div style="font-size:2.5rem; margin-bottom:12px;">🔍</div>
        <div style="font-size:1.15rem; font-weight:800; color:var(--text-title); margin-bottom:6px;">No dishes match your filters</div>
        <p style="font-size:0.85rem; margin-bottom:16px;">We couldn't find any dishes matching your current selection.</p>
        <button type="button" onclick="clearAllFilters()" class="btn-primary" style="padding:10px 20px; border-radius:12px; font-weight:800; border:none; cursor:pointer;" aria-label="View Full Menu">
          ✨ View Full Menu (Reset All Filters)
        </button>
      </div>`;
    return;
  }

  // Set container layout mode
  container.className = currentViewMode === 'grid' ? 'menu-container grid-view' : 'menu-container';

  let contentHtml = activeFiltersHtml;

  // If a specific category is filtered
  if (currentCategoryFilter && catMap.has(currentCategoryFilter)) {
    const cat = catMap.get(currentCategoryFilter);
    const catIcon = getCategoryIcon(cat.name);
    contentHtml += `
      <div class="category-section-banner">
        <div class="category-title-row">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.3rem;">${catIcon}</span>
            <h3 style="font-size:1.1rem; font-weight:900; color:var(--text-title); margin:0;">${cat.name}</h3>
            <span class="category-count-badge">${displayList.length} items</span>
          </div>
          <button type="button" class="btn-reset-filters" onclick="filterCategory(null)">Show All Categories</button>
        </div>
        ${cat.description ? `<div class="category-desc-text">${cat.description}</div>` : ''}
      </div>`;
    contentHtml += displayList.map(item => renderDishCard(item, now, currentViewMode, catMap)).join('');
  } else {
    // Grouping by category (when viewing all categories or search results across categories)
    const categories = menuData.categories || [];
    let itemsRendered = 0;

    for (const cat of categories) {
      const catItems = displayList.filter(i => i.categoryId === cat.id);
      if (catItems.length === 0) continue;

      const catIcon = getCategoryIcon(cat.name);
      contentHtml += `
        <div class="category-section-banner" id="cat-section-${cat.id}">
          <div class="category-title-row">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">${catIcon}</span>
              <h3 style="font-size:1.1rem; font-weight:900; color:var(--text-title); margin:0;">${cat.name}</h3>
              <span class="category-count-badge">${catItems.length} items</span>
            </div>
            <span class="category-timings-badge">${cat.daypartFrom ? `⏰ ${formatShiftTime(cat.daypartFrom)} - ${formatShiftTime(cat.daypartUntil)}` : ''}</span>
          </div>
          ${cat.description ? `<div class="category-desc-text">${cat.description}</div>` : ''}
        </div>`;
      contentHtml += catItems.map(item => renderDishCard(item, now, currentViewMode, catMap)).join('');
      itemsRendered += catItems.length;
    }

    // Any remaining items without a matched category
    const remainingItems = displayList.filter(i => !categories.some(c => c.id === i.categoryId));
    if (remainingItems.length > 0) {
      contentHtml += `
        <div class="category-section-banner">
          <div class="category-title-row">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">🍽️</span>
              <h3 style="font-size:1.1rem; font-weight:900; color:var(--text-title); margin:0;">Specialties</h3>
              <span class="category-count-badge">${remainingItems.length} items</span>
            </div>
          </div>
        </div>`;
      contentHtml += remainingItems.map(item => renderDishCard(item, now, currentViewMode, catMap)).join('');
    }
  }

  container.innerHTML = contentHtml;
}
window.renderMenu = renderMenu;

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

let managerPricingConfig = null;

async function loadManagerPricingConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/manager/pricing-config`);
    if (res.ok) {
      managerPricingConfig = await res.json();
      updateCartUI();
    }
  } catch (e) {}
}

function updateCartUI() {
  const totalCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotalCents = cart.reduce((s, i) => s + (i.unitPriceCents * i.quantity), 0);

  // Dynamic GST calculation from manager configuration
  const effectiveGstRate = (managerPricingConfig && managerPricingConfig.gstEnabled !== false)
    ? (managerPricingConfig.gstRate !== undefined ? managerPricingConfig.gstRate : 5.0)
    : 0.0;
  const taxCents = Math.round(subtotalCents * (effectiveGstRate / 100));

  // Service charge and takeaway packaging
  const serviceChargeRate = (managerPricingConfig && managerPricingConfig.serviceChargeEnabled)
    ? (managerPricingConfig.serviceChargeRate || 0.0)
    : 0.0;
  const serviceChargeCents = Math.round(subtotalCents * (serviceChargeRate / 100));

  const isTakeaway = (activeTable && (activeTable.number === 'Takeaway' || activeTable.number === 'TOKEN'));
  const packagingCents = (isTakeaway && managerPricingConfig) ? (managerPricingConfig.packagingChargeCents || 0) : 0;

  const tipCents = currentTipAmount * 100;
  const discountCents = bestOffer && bestOffer.savedCents ? bestOffer.savedCents : 0;
  const totalCents = Math.max(0, subtotalCents - discountCents) + taxCents + serviceChargeCents + packagingCents + tipCents;

  const bar = document.getElementById('abiruchiFloatingCart') || document.getElementById('floatingCartBar');
  if (bar) {
    if (totalCount > 0) {
      bar.classList.add('visible');
      bar.style.display = 'flex';
      const countEl = document.getElementById('cartCountBadge') || document.getElementById('floatingCartCount');
      const totalEl = document.getElementById('cartFloatingTotal') || document.getElementById('floatingCartTotal');
      if (countEl) countEl.textContent = `${totalCount} ${totalCount === 1 ? 'ITEM' : 'ITEMS'}`;
      if (totalEl) totalEl.textContent = formatINR(totalCents);
    } else {
      bar.classList.remove('visible');
      bar.style.display = 'none';
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
              <button type="button" class="abiruchi-step-btn" aria-label="Decrease quantity" onclick="removeFromCart('${item.itemId}')">−</button>
              <span class="abiruchi-qty-num">${item.quantity}</span>
              <button type="button" class="abiruchi-step-btn" aria-label="Increase quantity" onclick="addToCart('${item.itemId}')">+</button>
            </div>
            <div style="font-weight:800; min-width:60px; text-align:right; font-size:0.9rem;">${formatINR(item.unitPriceCents * item.quantity)}</div>
          </div>
        </div>`).join('');
    }
  }

  if (document.getElementById('sumSubtotal')) document.getElementById('sumSubtotal').textContent = formatINR(subtotalCents);
  if (document.getElementById('sumTax')) {
    document.getElementById('sumTax').textContent = formatINR(taxCents);
    const taxLabel = document.getElementById('sumTaxLabel');
    if (taxLabel) {
      taxLabel.textContent = effectiveGstRate > 0 ? `GST (${effectiveGstRate}%)` : 'Tax';
    }
  }
  if (document.getElementById('sumTip')) document.getElementById('sumTip').textContent = formatINR(tipCents);
  if (document.getElementById('sumDiscount')) document.getElementById('sumDiscount').textContent = `-${formatINR(discountCents)}`;
  if (document.getElementById('sumTotal')) document.getElementById('sumTotal').textContent = formatINR(totalCents);
  if (document.getElementById('payNowAmountText')) document.getElementById('payNowAmountText').textContent = formatINR(totalCents);
}

// Modal Handlers
function togglePortalsMenu() {
  const menu = document.getElementById('portalsDropdownMenu');
  const btn = document.getElementById('portalsMenuBtn');
  if (!menu) return;
  const isShown = menu.style.display === 'block';
  menu.style.display = isShown ? 'none' : 'block';
  if (btn) btn.setAttribute('aria-expanded', !isShown);
}
window.togglePortalsMenu = togglePortalsMenu;

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.portals-menu-wrap');
  const menu = document.getElementById('portalsDropdownMenu');
  if (menu && menu.style.display === 'block' && wrap && !wrap.contains(e.target)) {
    menu.style.display = 'none';
    const btn = document.getElementById('portalsMenuBtn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
});

function openCartModal() { document.getElementById('cartModal')?.classList.add('active'); lockBodyScroll(); pushModalState('cartModal'); }
function closeCartModal() { document.getElementById('cartModal')?.classList.remove('active'); unlockBodyScroll(); popModalState('cartModal'); }
function openWaiterModal() { document.getElementById('waiterModal')?.classList.add('active'); lockBodyScroll(); pushModalState('waiterModal'); }
function openWaiterCallModal() { openWaiterModal(); }
function closeWaiterModal() { document.getElementById('waiterModal')?.classList.remove('active'); unlockBodyScroll(); popModalState('waiterModal'); }
function closeOnBackdrop(e, modalId) { if (e.target.id === modalId) { document.getElementById(modalId)?.classList.remove('active'); unlockBodyScroll(); popModalState(modalId); } }

function setPaymentMethod(btn, method) {
  document.querySelectorAll('#cartModal .pill-group .opt-pill').forEach(b => {
    if (b.parentElement === btn.parentElement) b.classList.remove('active');
  });
  btn.classList.add('active');
  paymentMethod = method;

  const payBtn = document.getElementById('payNowBtn');
  const submitBtn = document.getElementById('submitOrderBtn');
  if (method === 'UPI') {
    if (payBtn) payBtn.style.display = 'flex';
    if (submitBtn) submitBtn.textContent = 'Send Order to Kitchen & Pay via UPI →';
  } else if (method === 'CASH') {
    if (payBtn) payBtn.style.display = 'none';
    if (submitBtn) submitBtn.textContent = 'Send Order to Kitchen & Pay Cash at Counter →';
  } else if (method === 'CARD') {
    if (payBtn) payBtn.style.display = 'none';
    if (submitBtn) submitBtn.textContent = 'Send Order to Kitchen & Pay via Card →';
  }
}
window.setPaymentMethod = setPaymentMethod;

// Group O Gratuity Handlers
function setTipPreset(btn, pct) {
  document.querySelectorAll('#tipPillGroup .opt-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const subtotalCents = cart.reduce((s, i) => s + (i.unitPriceCents * i.quantity), 0);
  if (pct === 0) {
    currentTipAmount = 0;
  } else {
    currentTipAmount = Math.round((subtotalCents * (pct / 100)) / 100);
  }
  updateCartUI();
}

function setTipCustom(btn) {
  const val = prompt('Enter custom tip amount in ₹:', '50');
  if (val !== null) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      document.querySelectorAll('#tipPillGroup .opt-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTipAmount = Math.round(num);
      updateCartUI();
    }
  }
}

function setTip(btn, amt) {
  document.querySelectorAll('#tipPillGroup .opt-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentTipAmount = amt;
  updateCartUI();
}

// Group O Split Bill
function adjustSplitGuests(delta) {
  splitGuestCount = Math.max(1, Math.min(20, splitGuestCount + delta));
  const countDisplay = document.getElementById('guestCountDisplay');
  if (countDisplay) countDisplay.textContent = splitGuestCount;

  const subtotalCents = cart.reduce((s, i) => s + (i.unitPriceCents * i.quantity), 0);
  const taxCents = Math.round(subtotalCents * 0.05);
  const tipCents = currentTipAmount * 100;
  const totalCents = subtotalCents + taxCents + tipCents;
  const perPersonCents = Math.round(totalCents / splitGuestCount);

  const summary = document.getElementById('splitSummaryText');
  if (summary) {
    summary.textContent = `${splitGuestCount} ${splitGuestCount === 1 ? 'Guest' : 'Guests'} (${formatINR(perPersonCents)} each)`;
  }
}

async function openSplitBillFlow() {
  const orderId = currentBillOrderId;
  if (!orderId) {
    showToast('No confirmed order available to split.');
    return;
  }
  const guests = splitGuestCount > 1 ? splitGuestCount : parseInt(prompt('How many guests are splitting the bill?', '2') || '2', 10);
  if (isNaN(guests) || guests < 2) return;

  try {
    const res = await fetch(`${API_BASE}/api/v1/payments/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        splitType: 'EQUAL',
        sharesCount: guests
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert(`Bill Split for ${guests} guests!\nTotal: ₹${data.totalINR}\nEach person: ₹${data.shares[0].amountINR}\n\nIndividual UPI intent & WhatsApp share link generated.`);
      if (data.whatsappShareText) {
        const waUrl = `https://wa.me/?text=${encodeURIComponent(data.whatsappShareText)}`;
        window.open(waUrl, '_blank');
      }
    } else {
      showToast(data.error || 'Failed to split bill');
    }
  } catch (e) {
    showToast('Network error splitting bill');
  }
}

// Group Q Retention & Bill Request
async function requestBillDirect() {
  if (!currentBillOrderId) {
    showToast('No active order to request bill for.');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/orders/${currentBillOrderId}/request-bill`, {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('🧾 Bill requested! Staff is on the way with your check.');
      dispatchWaiterCall('Bill Requested', 'BILL');
    } else {
      showToast(data.error || 'Failed to request bill');
    }
  } catch (e) {
    showToast('Network error requesting bill');
  }
}

async function promptLoyaltyIfEligible() {
  try {
    const sess = getOrCreateGuestSession();
    const res = await fetch(`${API_BASE}/api/v1/customers/loyalty-status`, {
      headers: { 'X-Guest-Session': sess }
    });
    const data = await res.json();
    if (data && data.optedIn === false) {
      document.getElementById('loyaltyModal')?.classList.add('active');
    }
  } catch (e) {}
}

async function submitLoyaltyOptIn() {
  const phone = document.getElementById('loyaltyPhone')?.value.trim();
  const name = document.getElementById('loyaltyName')?.value.trim() || 'Valued Guest';
  if (!phone || phone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number');
    return;
  }
  try {
    const sess = getOrCreateGuestSession();
    const res = await fetch(`${API_BASE}/api/v1/customers/opt-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name, sessionId: sess })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`🌟 Welcome ${name}! First loyalty stamp earned.`);
      document.getElementById('loyaltyModal')?.classList.remove('active');
    } else {
      showToast(data.error || 'Failed to register loyalty');
    }
  } catch (e) {
    showToast('Network error registering loyalty');
  }
}

function skipLoyaltyOptIn() {
  document.getElementById('loyaltyModal')?.classList.remove('active');
  showToast('You can join rewards anytime from the menu.');
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
  lockBodyScroll();
  pushModalState('billPreviewModal');
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
  unlockBodyScroll();
  popModalState('billPreviewModal');
}

function printBillPreview() {
  window.print();
}

function initiateUpiFromBill() {
  closeBillPreviewModal();
  if (currentBillOrderId) {
    openUpiPrepaymentModal(currentBillOrderId);
  } else if (cart.length > 0) {
    openCartModal();
  } else {
    showToast('No active order or items in cart to pay.');
  }
}
window.initiateUpiFromBill = initiateUpiFromBill;

async function handleInstantPayment() {
  if (cart.length > 0) {
    paymentMethod = 'UPI';
    await handlePreOrderCheckout();
  } else if (currentBillOrderId) {
    openUpiPrepaymentModal(currentBillOrderId);
  } else {
    showToast('Cart is empty. Please select food items first.');
  }
}
window.handleInstantPayment = handleInstantPayment;

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
    const guestSession = getOrCreateGuestSession();
    const res = await fetch(`${API_BASE}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Guest-Session': guestSession,
      },
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

      // Save order to history for 1-tap reordering & receipt tracking
      saveOrderToHistory({
        id: created.id,
        orderId: created.id,
        token: created.token || (created.token_id ? `TK-${created.token_id}` : `TK-${created.id.slice(0, 4).toUpperCase()}`),
        date: new Date().toISOString(),
        items: payload.items.map(pi => {
          const mItem = (menuData.items || []).find(m => m.id === pi.menuItemId);
          return {
            id: pi.menuItemId,
            name: mItem ? mItem.name : 'Dish',
            quantity: pi.quantity,
            priceCents: mItem ? mItem.basePriceCents : 0,
          };
        }),
        totalCents: created.totalCents || created.totalAmountCents || (payload.items.reduce((s, pi) => {
          const mItem = (menuData.items || []).find(m => m.id === pi.menuItemId);
          return s + (mItem ? mItem.basePriceCents * pi.quantity : 0);
        }, 0) + (payload.tipCents || 0)),
      });

      cart = [];
      updateCartUI();
      closeCartModal();
      showToast('Order confirmed by kitchen!');
      playGuestChime('success');
      speakGuestAnnouncement('Your order has been submitted to the kitchen.');
      if (created.token) {
        const tokenBadge = document.getElementById('tokenBadgeContainer');
        const tokenCode = document.getElementById('guestTokenCode');
        if (tokenBadge && tokenCode) {
          tokenCode.textContent = created.token;
          tokenBadge.style.display = 'block';
        }
      }
      if (paymentMethod === 'UPI') {
        openUpiPrepaymentModal(created.id);
      } else {
        openOrderStatusModal(created.id);
      }
      setTimeout(promptLoyaltyIfEligible, 1200);
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

// ==========================================================================
// UPI Prepayment & Token Verification Handlers
// ==========================================================================
let currentUpiData = null;
let upiPollInterval = null;

async function openUpiPrepaymentModal(orderId) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/payments/upi/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    if (!res.ok) {
      openOrderStatusModal(orderId);
      return;
    }
    const data = await res.json();
    currentUpiData = data;
    currentBillOrderId = orderId;

    const tokEl = document.getElementById('upiOrderToken');
    if (tokEl) tokEl.textContent = data.token || '---';
    const idEl = document.getElementById('upiOrderIdText');
    if (idEl) idEl.textContent = orderId;
    const amtEl = document.getElementById('upiPayableAmount');
    if (amtEl) amtEl.textContent = `₹${data.amountINR}`;
    const amtInput = document.getElementById('upiAmountPaidInput');
    if (amtInput) amtInput.value = data.amountINR;

    const qrImg = document.getElementById('upiModalQrImg');
    if (qrImg) qrImg.src = data.qrImageUrl;

    const intentBtn = document.getElementById('upiModalIntentBtn');
    if (intentBtn) intentBtn.href = data.upiUri;

    // Prefill customer profile
    const savedName = localStorage.getItem('abiruchi_guest_name') || '';
    const savedPhone = localStorage.getItem('abiruchi_guest_phone') || '';
    const nameInput = document.getElementById('upiCustomerNameInput');
    const phoneInput = document.getElementById('upiCustomerPhoneInput');
    if (nameInput && !nameInput.value) nameInput.value = savedName;
    if (phoneInput && !phoneInput.value) phoneInput.value = savedPhone;

    // Reset steps
    const s1 = document.getElementById('upiStep1Box');
    if (s1) s1.style.display = 'block';
    const s2 = document.getElementById('upiStep2Box');
    if (s2) s2.style.display = 'block';
    const s3 = document.getElementById('upiStep3Box');
    if (s3) s3.style.display = 'none';
    const alertEl = document.getElementById('upiRejectionAlert');
    if (alertEl) alertEl.style.display = 'none';

    document.getElementById('upiPrepaymentModal')?.classList.add('active');
    lockBodyScroll();
  } catch (err) {
    console.error('Error initiating UPI prepayment:', err);
    openOrderStatusModal(orderId);
  }
}

let guestPaymentConfig = null;

async function loadPaymentConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/payments/config`);
    if (res.ok) {
      guestPaymentConfig = await res.json();
      syncGuestPaymentConfigUI();
    }
  } catch (e) {
    console.warn('Failed to load payment config', e);
  }
}

function syncGuestPaymentConfigUI() {
  if (!guestPaymentConfig) return;
  const vpa = guestPaymentConfig.upiVpa || '9010150809@ybl';
  const name = guestPaymentConfig.payeeName || 'Abiruchi Hotel';
  const qrImg = document.getElementById('upiQrImg');
  if (qrImg) {
    const qrData = encodeURIComponent(`upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&cu=INR`);
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;
  }
  const vpaDisplay = document.getElementById('upiVpaDisplay');
  if (vpaDisplay) {
    vpaDisplay.textContent = `VPA: ${vpa}`;
  }
  const boxHeader = document.getElementById('upiBoxHeader');
  if (boxHeader && name) {
    boxHeader.textContent = `🍛 ${name.toUpperCase()} • DIRECT PREPAYMENT`;
  }
  const intentLink = document.getElementById('upiIntentLink');
  if (intentLink) {
    intentLink.href = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&cu=INR`;
  }
}

function copyConfiguredVpa() {
  const vpa = guestPaymentConfig?.upiVpa || '9010150809@ybl';
  navigator.clipboard.writeText(vpa);
  showToast(`📋 Copied UPI ID: ${vpa}`);
}
window.copyConfiguredVpa = copyConfiguredVpa;

function closeUpiPrepaymentModal() {
  document.getElementById('upiPrepaymentModal')?.classList.remove('active');
  unlockBodyScroll();
  if (upiPollInterval) { clearInterval(upiPollInterval); upiPollInterval = null; }
}

function copyUpiVpa() {
  const vpa = currentUpiData?.payeeVpa || guestPaymentConfig?.upiVpa || '9010150809@ybl';
  navigator.clipboard.writeText(vpa);
  showToast(`📋 Copied UPI ID: ${vpa}`);
}

function copyOrderRef() {
  const ref = currentUpiData?.orderRef || currentBillOrderId || '';
  navigator.clipboard.writeText(ref);
  showToast(`📋 Copied Order Ref: ${ref}`);
}

async function submitUpiPaymentReferenceAction() {
  const utrInput = document.getElementById('upiUtrInput');
  const utr = (utrInput ? utrInput.value.trim() : '');
  if (!utr) {
    showToast('⚠️ Please enter the 12-digit UPI reference / UTR number');
    utrInput?.focus();
    return;
  }
  if (!/^[a-zA-Z0-9_\-]{6,35}$/.test(utr)) {
    showToast('⚠️ Invalid UTR format. Please enter a valid reference number.');
    utrInput?.focus();
    return;
  }

  const name = document.getElementById('upiCustomerNameInput')?.value.trim() || 'Guest';
  const phone = document.getElementById('upiCustomerPhoneInput')?.value.trim() || '';
  const amountPaid = parseFloat(document.getElementById('upiAmountPaidInput')?.value || '0');

  const rememberGuest = document.getElementById('rememberMeGuest')?.checked ?? true;
  if (rememberGuest) {
    if (name) localStorage.setItem('abiruchi_guest_name', name);
    if (phone) localStorage.setItem('abiruchi_guest_phone', phone);
  } else {
    localStorage.removeItem('abiruchi_guest_name');
    localStorage.removeItem('abiruchi_guest_phone');
  }

  const submitBtn = document.getElementById('upiSubmitRefBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting for Verification...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/payments/upi/submit-reference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: currentBillOrderId,
        utr,
        amountPaid,
        customerName: name,
        customerPhone: phone
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(`❌ ${data.error || 'Submission failed'}`);
      return;
    }

    showToast('✓ Payment details submitted for manager verification');

    // Update UI to Step 3
    const s2 = document.getElementById('upiStep2Box');
    if (s2) s2.style.display = 'none';
    const step3 = document.getElementById('upiStep3Box');
    if (step3) step3.style.display = 'block';

    const waBtn = document.getElementById('upiWhatsAppBtn');
    if (waBtn && data.whatsAppUrl) {
      waBtn.href = data.whatsAppUrl;
      waBtn.style.display = 'inline-flex';
    }

    // Start live polling for manager verification
    startUpiStatusPolling(currentBillOrderId);
  } catch (err) {
    showToast('Network error submitting payment reference.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '✓ Submit Payment Details';
    }
  }
}

function startUpiStatusPolling(orderId) {
  if (upiPollInterval) clearInterval(upiPollInterval);
  upiPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/order-status/${orderId}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.paymentStatus === 'PAID' || data.paymentStatus === 'VERIFIED') {
        clearInterval(upiPollInterval);
        upiPollInterval = null;
        playGuestChime('success');
        speakGuestAnnouncement('Payment verified! Your order is now preparing in the kitchen.');
        showToast('🎉 Payment verified by manager! Kitchen is preparing your order.');
        closeUpiPrepaymentModal();
        openOrderStatusModal(orderId);
      } else if (data.paymentStatus === 'REJECTED') {
        clearInterval(upiPollInterval);
        upiPollInterval = null;
        playGuestChime('alert');
        speakGuestAnnouncement('Payment reference rejected by manager. Please verify your reference and resubmit.');
        const s2 = document.getElementById('upiStep2Box');
        if (s2) s2.style.display = 'block';
        const alertEl = document.getElementById('upiRejectionAlert');
        if (alertEl) {
          alertEl.textContent = `❌ Payment Rejected: ${data.rejectionReason || 'Invalid reference'}. Please check your UTR and resubmit.`;
          alertEl.style.display = 'block';
        }
        showToast(`❌ Payment Rejected: ${data.rejectionReason || 'Please resubmit valid UTR'}`);
      }
    } catch (e) {}
  }, 3000);
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
  lockBodyScroll();
  pushModalState('orderStatusModal');
  pollOrderStatus(orderId);
  if (liveTrackingInterval) clearInterval(liveTrackingInterval);
  liveTrackingInterval = setInterval(() => pollOrderStatus(orderId), 3000);
}

function closeOrderStatusModal() {
  document.getElementById('orderStatusModal')?.classList.remove('active');
  unlockBodyScroll();
  popModalState('orderStatusModal');
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
  unlockBodyScroll();
  showToast('Thank you for your valuable feedback!');
}

// Guest Profile, Sign In & Sign Out System
let selectedOnboardingLang = 'en';
let selectedOnboardingDiet = 'ALL';

function selectLoginLang(lang) {
  selectedOnboardingLang = lang;
  ['en', 'te', 'hi'].forEach(l => {
    const btn = document.getElementById(`langChoice_${l}`);
    if (btn) btn.classList.toggle('active', l === lang);
  });
}
window.selectLoginLang = selectLoginLang;

function selectLoginDiet(diet) {
  selectedOnboardingDiet = diet;
  ['ALL', 'VEG', 'NON_VEG', 'BESTSELLER'].forEach(d => {
    const btn = document.getElementById(`dietChoice_${d}`);
    if (btn) btn.classList.toggle('active', d === diet);
  });
}
window.selectLoginDiet = selectLoginDiet;

function saveGuestOnboarding() {
  const phone = document.getElementById('guestPhoneInput')?.value.trim();
  const name = document.getElementById('guestNameInput')?.value.trim();

  if (phone) {
    if (phone.length < 10) {
      showToast('Please enter a valid 10-digit mobile number or leave blank.');
      return;
    }
    localStorage.setItem('abiruchi_guest_phone', phone);
  } else {
    localStorage.removeItem('abiruchi_guest_phone');
  }

  if (name) {
    localStorage.setItem('abiruchi_guest_name', name);
  }

  localStorage.setItem('abiruchi_guest_lang', selectedOnboardingLang);
  localStorage.setItem('abiruchi_guest_diet', selectedOnboardingDiet);

  // Apply chosen preferences immediately
  if (selectedOnboardingLang !== currentLang) {
    switchLanguage(selectedOnboardingLang);
  }

  const dietBtnMap = {
    'ALL': document.getElementById('filterAllBtn'),
    'VEG': document.getElementById('filterVegBtn'),
    'NON_VEG': document.getElementById('filterNonVegBtn'),
    'BESTSELLER': document.getElementById('filterBestsellerBtn')
  };
  if (dietBtnMap[selectedOnboardingDiet]) {
    toggleDietFilter(selectedOnboardingDiet, dietBtnMap[selectedOnboardingDiet]);
  }

  updateLoginStateUI();
  closeLoginModal();
  showToast('✓ Preferences saved! Welcome to Abiruchi Hotel.');
}
window.saveGuestOnboarding = saveGuestOnboarding;

function updateLoginStateUI() {
  const phone = localStorage.getItem('abiruchi_guest_phone');
  const name = localStorage.getItem('abiruchi_guest_name');
  const userLabel = document.getElementById('userLoginLabel');
  const logoutBtn = document.getElementById('headerLogoutBtn');
  const profileSection = document.getElementById('loggedInProfileSection');
  const otpSection = document.getElementById('loginOtpStep');
  const prefsSection = document.getElementById('prefsStep');
  const guestPhoneEl = document.getElementById('loggedInGuestPhone');
  const guestNameEl = document.getElementById('loggedInGuestName');

  const lang = localStorage.getItem('abiruchi_guest_lang') || currentLang || 'en';
  const diet = localStorage.getItem('abiruchi_guest_diet') || currentDietaryFilter || 'ALL';
  selectLoginLang(lang);
  selectLoginDiet(diet);
  const phoneInput = document.getElementById('guestPhoneInput');
  if (phoneInput && phone) phoneInput.value = phone;
  const nameInput = document.getElementById('guestNameInput');
  if (nameInput && name) nameInput.value = name;

  if (phone) {
    if (userLabel) userLabel.textContent = name || `+91 ${phone.slice(-4)}`;
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (profileSection) profileSection.style.display = 'block';
    if (otpSection) otpSection.style.display = 'none';
    if (prefsSection) prefsSection.style.display = 'none';
    if (guestPhoneEl) guestPhoneEl.textContent = `+91 ${phone}`;
    if (guestNameEl) guestNameEl.textContent = name || 'Valued Guest';
  } else {
    const dict = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS.en;
    if (userLabel) userLabel.textContent = dict.signIn || 'Sign In';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (profileSection) profileSection.style.display = 'none';
    if (otpSection) otpSection.style.display = 'block';
    if (prefsSection) prefsSection.style.display = 'none';
  }
}
window.updateLoginStateUI = updateLoginStateUI;

function togglePrefsView() {
  const profileSection = document.getElementById('loggedInProfileSection');
  const prefsSection = document.getElementById('prefsStep');
  if (prefsSection && profileSection) {
    const isShowingPrefs = prefsSection.style.display === 'block';
    prefsSection.style.display = isShowingPrefs ? 'none' : 'block';
    profileSection.style.display = isShowingPrefs ? 'block' : 'none';
  }
}
window.togglePrefsView = togglePrefsView;

function handleLogout() {
  localStorage.removeItem('abiruchi_guest_phone');
  localStorage.removeItem('abiruchi_guest_name');
  localStorage.removeItem('abiruchi_token');
  localStorage.removeItem('abiruchi_session');
  showToast('✓ Successfully logged out');
  updateLoginStateUI();
  closeLoginModal();
}
window.handleLogout = handleLogout;

function switchCustomerJourney(journey) {
  currentJourney = journey;
  document.querySelectorAll('.journey-tab').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('scheduledOrderPanel');

  if (journey === 'ORDER_NOW') {
    document.getElementById('journeyOrderNow')?.classList.add('active');
    if (panel) panel.style.display = 'none';
    showToast('⚡ Dine-in Instant Order active');
  } else if (journey === 'ORDER_LATER') {
    document.getElementById('journeyOrderLater')?.classList.add('active');
    if (panel) panel.style.display = 'block';
    if (typeof loadScheduledPickupSlots === 'function') loadScheduledPickupSlots();
    showToast('🕒 Scheduled Pickup Order active');
  } else if (journey === 'BOOK_TABLE') {
    document.getElementById('journeyBookTable')?.classList.add('active');
    window.location.href = '/booking';
  } else if (journey === 'DINE_IN') {
    document.getElementById('journeyDineIn')?.classList.add('active');
    if (panel) panel.style.display = 'none';
    showToast('🍽️ Dine-In QR Mode active');
  }
}
window.switchCustomerJourney = switchCustomerJourney;

function openLoginModal() {
  updateLoginStateUI();
  document.getElementById('loginModal')?.classList.add('active');
  lockBodyScroll();
  pushModalState('loginModal');
}
function closeLoginModal() {
  document.getElementById('loginModal')?.classList.remove('active');
  unlockBodyScroll();
  popModalState('loginModal');
}

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
      updateLoginStateUI();
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
let currentModalDishQty = 1;

function updateModalDishQtyDisplay() {
  const item = (menuData.items || []).find(i => i.id === currentModalDishId);
  const qtyEl = document.getElementById('dishModalQtyDisplay');
  const priceEl = document.getElementById('dishModalTotalPrice');
  if (qtyEl) qtyEl.textContent = currentModalDishQty;
  if (priceEl && item) {
    priceEl.textContent = formatINR(item.basePriceCents * currentModalDishQty);
  }
}

function adjustModalDishQty(delta) {
  currentModalDishQty = Math.max(1, currentModalDishQty + delta);
  updateModalDishQtyDisplay();
}
window.adjustModalDishQty = adjustModalDishQty;

function openDishDetailsModal(itemId) {
  const item = (menuData.items || []).find(i => i.id === itemId);
  if (!item) return;
  currentModalDishId = itemId;

  const existingInCart = cart.find(ci => ci.itemId === itemId);
  currentModalDishQty = existingInCart ? existingInCart.quantity : 1;

  const titleEl = document.getElementById('dishModalTitle');
  const imgEl = document.getElementById('dishModalImg');
  const priceEl = document.getElementById('dishModalPrice');
  const descEl = document.getElementById('dishModalDesc');
  if (titleEl) titleEl.textContent = item.name;
  if (imgEl) {
    const photo = (item.imageUrl && !item.imageUrl.includes('photo-1546069901-ba9599a7e63c'))
      ? item.imageUrl
      : (window.getAutoDishPhoto ? window.getAutoDishPhoto(item.name, item.categoryId) : 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80');
    imgEl.src = photo;
  }
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

  updateModalDishQtyDisplay();
  document.getElementById('dishDetailModal')?.classList.add('active');
  lockBodyScroll();
  pushModalState('dishDetailModal');
}

function closeDishDetailModal() {
  document.getElementById('dishDetailModal')?.classList.remove('active');
  unlockBodyScroll();
  popModalState('dishDetailModal');
  currentModalDishId = null;
}

function addCurrentModalDishToCart() {
  if (currentModalDishId) {
    const item = (menuData.items || []).find(i => i.id === currentModalDishId);
    if (!item) return;

    const existing = cart.find(i => i.itemId === currentModalDishId);
    if (existing) {
      existing.quantity = currentModalDishQty;
    } else {
      cart.push({
        itemId: item.id,
        name: item.name,
        unitPriceCents: item.basePriceCents,
        quantity: currentModalDishQty,
        course: 'MAIN'
      });
    }

    updateCartUI();
    renderMenu();
    closeDishDetailModal();
    showToast(`✓ Added ${currentModalDishQty} × ${item.name} to order`);
  }
}

// Guest Session Management & Repeat Last Order (Group D)
function getOrCreateGuestSession() {
  let sess = localStorage.getItem('abiruchi_session');
  if (!sess) {
    sess = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'sess_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('abiruchi_session', sess);
  }
  return sess;
}

let lastOrderData = null;
async function checkRepeatLastOrder() {
  const sess = getOrCreateGuestSession();
  try {
    const res = await fetch(`${API_BASE}/api/v1/orders/last?session=${encodeURIComponent(sess)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.order && data.items && data.items.length > 0) {
        lastOrderData = data;
        const banner = document.getElementById('repeatLastOrderBanner');
        const summary = document.getElementById('repeatOrderSummary');
        if (banner) {
          if (summary) {
            const itemNames = data.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
            summary.textContent = itemNames;
          }
          banner.style.display = 'flex';
        }
      }
    }
  } catch (e) {}
}

function repeatLastOrder() {
  if (!lastOrderData || !lastOrderData.items) return;
  for (const it of lastOrderData.items) {
    for (let q = 0; q < it.quantity; q++) {
      addToCart(it.menuItemId || it.id || it.name);
    }
  }
  showToast('Added items from previous order to cart!');
  openCartModal();
}

async function forgetGuestSession() {
  const sess = localStorage.getItem('abiruchi_session');
  if (sess) {
    try {
      await fetch(`${API_BASE}/api/v1/orders/session/${encodeURIComponent(sess)}`, { method: 'DELETE' });
    } catch (e) {}
    localStorage.removeItem('abiruchi_session');
  }
  localStorage.removeItem('abiruchi_guest_phone');
  const banner = document.getElementById('repeatLastOrderBanner');
  if (banner) banner.style.display = 'none';
  showToast('Your session history has been cleared.');
}

// Tenant Profile & About Panel (Case 7)
async function loadTenantProfile() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/tenant/profile`);
    if (res.ok) {
      const prof = await res.json();
      if (prof) {
        if (prof.name) {
          const t = document.getElementById('aboutHotelTitle');
          if (t) t.textContent = `About ${prof.name}`;
        }
        if (prof.about_text) {
          const s = document.getElementById('aboutStory');
          if (s) s.textContent = prof.about_text;
        }
        if (prof.today_special) {
          const sp = document.getElementById('aboutTodaySpecial');
          if (sp) sp.textContent = prof.today_special;
        }
        if (prof.address) {
          const a = document.getElementById('aboutAddress');
          if (a) a.textContent = prof.address;
        }
        if (prof.operating_hours) {
          const h = document.getElementById('aboutHours');
          if (h) h.textContent = prof.operating_hours;
        }
        if (prof.phone) {
          const p = document.getElementById('aboutPhone');
          if (p) {
            p.textContent = prof.phone;
            p.href = `tel:${prof.phone}`;
          }
        }
        if (prof.map_link) {
          const m = document.getElementById('aboutMapLink');
          if (m) m.href = prof.map_link;
        } else if (prof.address) {
          const m = document.getElementById('aboutMapLink');
          if (m) m.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prof.address)}`;
        }
        if (prof.gstin) {
          const g = document.getElementById('aboutGstin');
          if (g) g.textContent = prof.gstin;
        }
        if (prof.fssai) {
          const f = document.getElementById('aboutFssai');
          if (f) f.textContent = prof.fssai;
        }
      }
    }
  } catch (e) {}
}

function toggleAboutPanel(forceOpen) {
  const content = document.getElementById('aboutPanelContent');
  const chevron = document.getElementById('aboutPanelChevron');
  const header = document.getElementById('aboutPanelHeader');
  if (!content) return;
  const shouldOpen = typeof forceOpen === 'boolean'
    ? forceOpen
    : (content.style.display === 'none' || content.style.display === '');
  content.style.display = shouldOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = shouldOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  if (header) header.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}
window.toggleAboutPanel = toggleAboutPanel;

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#aboutPanel') {
    toggleAboutPanel(true);
  }
});

// ==========================================================================
// Web Speech API Voice Ordering (Phase 2 UX)
// ==========================================================================
let guestSpeechRecognition = null;

function startVoiceOrder() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice ordering requires Web Speech support (Chrome, Edge, Safari on mobile/desktop).');
    return;
  }

  const voiceModal = document.getElementById('voiceModal');
  const transcriptEl = document.getElementById('voiceLiveTranscript');
  const micBtn = document.getElementById('btnVoiceOrder');
  if (voiceModal) voiceModal.style.display = 'flex';
  lockBodyScroll();
  if (transcriptEl) transcriptEl.textContent = 'Listening... Speak dish name or quantity.';
  if (micBtn) micBtn.classList.add('listening');

  try {
    guestSpeechRecognition = new SpeechRecognition();
    guestSpeechRecognition.lang = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
    guestSpeechRecognition.continuous = false;
    guestSpeechRecognition.interimResults = true;

    guestSpeechRecognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        interim += event.results[i][0].transcript;
      }
      if (transcriptEl) transcriptEl.textContent = `"${interim}"`;

      if (event.results[0].isFinal) {
        processVoiceCommand(interim.trim());
      }
    };

    guestSpeechRecognition.onerror = () => {
      if (transcriptEl) transcriptEl.textContent = 'Could not hear clearly. Please tap microphone to try again.';
      stopVoiceOrder();
    };

    guestSpeechRecognition.onend = () => {
      if (micBtn) micBtn.classList.remove('listening');
    };

    guestSpeechRecognition.start();
  } catch (err) {
    console.error('Speech error:', err);
    stopVoiceOrder();
  }
}

function stopVoiceOrder() {
  if (guestSpeechRecognition) {
    try { guestSpeechRecognition.stop(); } catch (e) {}
  }
  const voiceModal = document.getElementById('voiceModal');
  const micBtn = document.getElementById('btnVoiceOrder');
  if (voiceModal) voiceModal.style.display = 'none';
  if (micBtn) micBtn.classList.remove('listening');
  unlockBodyScroll();
}

function closeVoiceModal(event) {
  if (event && event.target && event.target.id === 'voiceModal') {
    stopVoiceOrder();
  }
}

let guestSpeakerEnabled = localStorage.getItem('servora_guest_speaker') !== null ? localStorage.getItem('servora_guest_speaker') === 'true' : true;

function syncGuestSpeakerUI() {
  const btn = document.getElementById('guestSpeakerToggle');
  const icon = document.getElementById('guestSpeakerIcon');
  if (!btn || !icon) return;
  if (guestSpeakerEnabled) {
    icon.textContent = '🔊';
    btn.title = 'Speaker Announcements: ON (Click to mute)';
    btn.style.color = '#10b981';
    btn.style.borderColor = 'rgba(16,185,129,0.4)';
    btn.style.background = 'rgba(16,185,129,0.1)';
  } else {
    icon.textContent = '🔇';
    btn.title = 'Speaker Announcements: OFF (Click to unmute)';
    btn.style.color = 'var(--text-muted)';
    btn.style.borderColor = 'var(--chip-border)';
    btn.style.background = 'var(--chip-bg)';
  }
}

function toggleGuestSpeaker() {
  guestSpeakerEnabled = !guestSpeakerEnabled;
  localStorage.setItem('servora_guest_speaker', String(guestSpeakerEnabled));
  syncGuestSpeakerUI();
  if (guestSpeakerEnabled) {
    playGuestChime('success');
    speakFeedback('Speaker voice announcements enabled.');
  }
}

function playGuestChime(type = 'notification') {
  if (!guestSpeakerEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {}
}

function speakGuestAnnouncement(text) {
  if (!guestSpeakerEnabled) return;
  speakFeedback(text);
}

function speakFeedback(text) {
  if ('speechSynthesis' in window) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
}

function processVoiceCommand(text) {
  stopVoiceOrder();
  const lower = text.toLowerCase();

  // 1. Dietary filter commands
  if (lower.includes('show veg') || lower.includes('pure veg') || lower.includes('vegetarian')) {
    toggleDietFilter('VEG', document.getElementById('filterVegBtn'));
    speakFeedback('Showing vegetarian dishes.');
    showToast('Filtered to Vegetarian');
    return;
  }
  if (lower.includes('show non veg') || lower.includes('non veg')) {
    toggleDietFilter('NON_VEG', document.getElementById('filterNonVegBtn'));
    speakFeedback('Showing non-vegetarian dishes.');
    showToast('Filtered to Non-Vegetarian');
    return;
  }
  if (lower.includes('all items') || lower.includes('show all')) {
    filterByShift('ALL', document.getElementById('shiftChipAll'));
    toggleDietFilter('ALL', document.getElementById('filterAllBtn'));
    speakFeedback('Showing all menu items.');
    return;
  }

  // 2. Quantity extraction (e.g. "two masala dosa", "3 biryani")
  let quantity = 1;
  const numberWords = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'okati': 1, 'rendu': 2, 'moodu': 3, 'ek': 1, 'do': 2, 'teen': 3 };
  for (const [w, n] of Object.entries(numberWords)) {
    if (lower.startsWith(w + ' ') || lower.includes(' ' + w + ' ')) {
      quantity = n;
      break;
    }
  }
  const digitMatch = lower.match(/\b(\d+)\b/);
  if (digitMatch) {
    quantity = parseInt(digitMatch[1], 10);
  }

  // Clean trigger words
  const cleanQuery = lower
    .replace(/\b(order|please|give|me|add|want|two|three|four|five|six|one|ek|do|teen|okati|rendu|moodu|plate|plates|cup|cups)\b/g, '')
    .trim();

  // Find matching menu item
  const allItems = menuData.items || [];
  let matchedItem = null;

  if (cleanQuery.length >= 2) {
    matchedItem = allItems.find(i => i.name.toLowerCase() === cleanQuery);
    if (!matchedItem) {
      matchedItem = allItems.find(i => i.name.toLowerCase().includes(cleanQuery) || cleanQuery.includes(i.name.toLowerCase()));
    }
  }

  if (matchedItem) {
    for (let k = 0; k < quantity; k++) {
      addToCart(matchedItem.id);
    }
    const msg = `Added ${quantity > 1 ? quantity + ' ' : ''}${matchedItem.name} to your order!`;
    showToast(`🎙️ ${msg}`);
    speakFeedback(msg);
  } else {
    // Treat as search query
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = cleanQuery || text;
      handleSearch(cleanQuery || text);
      const msg = `Showing search results for ${cleanQuery || text}`;
      showToast(`🎙️ ${msg}`);
      speakFeedback(msg);
    }
  }
}

// ==========================================================================
// Order History and 1-Tap Reorder (Phase 2 UX)
// ==========================================================================
function saveOrderToHistory(orderData) {
  try {
    const list = JSON.parse(localStorage.getItem('abiruchi_orders_history') || '[]');
    list.unshift(orderData);
    localStorage.setItem('abiruchi_orders_history', JSON.stringify(list.slice(0, 25)));
  } catch (e) {}
}

function openHistoryModal() {
  const modal = document.getElementById('historyModal');
  const container = document.getElementById('historyOrdersList');
  if (!modal || !container) return;

  const history = JSON.parse(localStorage.getItem('abiruchi_orders_history') || '[]');
  if (history.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:32px 16px; color:var(--text-muted);">
        <div style="font-size:2rem; margin-bottom:8px;">🍽️</div>
        <p style="font-weight:700;">No past orders on this device yet.</p>
        <span style="font-size:0.8rem;">Your completed dining orders and receipts will appear here for 1-tap reordering.</span>
      </div>`;
  } else {
    container.innerHTML = history.map((ord, idx) => {
      const dateStr = ord.date ? new Date(ord.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const itemsList = (ord.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
      let effectiveCents = ord.totalCents;
      if (!effectiveCents && Array.isArray(ord.items)) {
        effectiveCents = ord.items.reduce((s, it) => s + ((it.priceCents || 5000) * (it.quantity || 1)), 0);
      }
      const totalFmt = formatINR(effectiveCents || 0);
      const targetOrderId = ord.orderId || ord.id || '';

      return `
        <div class="history-order-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="background:var(--primary); color:#fff; font-size:0.75rem; font-weight:900; padding:2px 8px; border-radius:6px;">${ord.token || 'TOKEN'}</span>
              <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">${dateStr}</span>
            </div>
            <span style="font-size:0.9rem; font-weight:900; color:var(--text-title);">${totalFmt}</span>
          </div>
          <div style="font-size:0.82rem; color:var(--text); font-weight:600; margin-bottom:10px;">${itemsList}</div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            ${targetOrderId ? `
              <a href="/receipt?orderId=${targetOrderId}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:6px 12px; border-radius:8px; font-weight:800; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
                🧾 Receipt
              </a>
            ` : ''}
            <button type="button" onclick="reorderPastOrder(${idx})" class="btn-primary" style="background:#ea580c; color:#fff; border:none; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.75rem; cursor:pointer; display:flex; align-items:center; gap:4px;">
              🔁 Reorder in 1-Tap
            </button>
          </div>
        </div>`;
    }).join('');
  }

  modal.style.display = 'flex';
  lockBodyScroll();
  pushModalState('historyModal');
}

function closeHistoryModal(event) {
  if (event && event.target && event.target.id !== 'historyModal') return;
  const modal = document.getElementById('historyModal');
  if (modal) modal.style.display = 'none';
  unlockBodyScroll();
  popModalState('historyModal');
}

function reorderPastOrder(index) {
  const history = JSON.parse(localStorage.getItem('abiruchi_orders_history') || '[]');
  const order = history[index];
  if (!order || !order.items || order.items.length === 0) return;

  order.items.forEach(pastItem => {
    const menuItem = (menuData.items || []).find(m => m.id === pastItem.id || m.name.toLowerCase() === pastItem.name.toLowerCase());
    if (menuItem) {
      const existing = cart.find(ci => ci.itemId === menuItem.id);
      if (existing) {
        existing.quantity += pastItem.quantity;
      } else {
        cart.push({
          itemId: menuItem.id,
          name: menuItem.name,
          unitPriceCents: menuItem.basePriceCents,
          quantity: pastItem.quantity,
          course: 'MAIN',
        });
      }
    }
  });

  updateCartUI();
  renderMenu();
  closeHistoryModal();
  openCartModal();
  showToast('✓ Previous order loaded into cart!');
}

// Global Lifecycle Initializer
async function init() {
  initTheme();
  initUserSessionState();
  syncGuestSpeakerUI();
  // 0ms instant display from local storage cache
  loadCachedMenuImmediately();
  // Fetch session, languages, menu, and pricing config in parallel without blocking waterfalls
  await Promise.allSettled([
    loadLanguages(),
    initSession(),
    loadMenu(currentLang),
    loadManagerPricingConfig(),
  ]);
  loadSpecials();
  loadBestOffer(0);
  loadAIRecommendations();
  checkRepeatLastOrder();
  loadTenantProfile();
  loadPaymentConfig();

  // Real-time live clock and view mode initialization
  updateLiveClock();
  setInterval(updateLiveClock, 30000);
  setViewMode(currentViewMode);

  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => prefetchLanguages(['te', 'hi']));
  } else {
    setTimeout(() => prefetchLanguages(['te', 'hi']), 1000);
  }
}

function initUserSessionState() {
  const savedLang = localStorage.getItem('abiruchi_guest_lang');
  if (savedLang && ['en', 'te', 'hi'].includes(savedLang)) {
    currentLang = savedLang;
  }
  const savedDiet = localStorage.getItem('abiruchi_guest_diet') || localStorage.getItem('abiruchi_user_diet');
  if (savedDiet) {
    currentDietaryFilter = savedDiet;
    const dietBtnMap = {
      'ALL': document.getElementById('filterAllBtn'),
      'VEG': document.getElementById('filterVegBtn'),
      'NON_VEG': document.getElementById('filterNonVegBtn'),
      'BESTSELLER': document.getElementById('filterBestsellerBtn'),
      'GLUTEN_FREE': document.getElementById('filterGlutenFreeBtn')
    };
    if (dietBtnMap[savedDiet]) {
      applyDietaryFilter(savedDiet, dietBtnMap[savedDiet]);
    }
  }
  updateLoginStateUI();
}

window.addEventListener('DOMContentLoaded', init);
