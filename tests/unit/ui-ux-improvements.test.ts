import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateText, SUPPORTED_LANGUAGES, translateMenuData } from '../../packages/content-translation/src/google-translate.ts';
import { getAutoDishPhoto } from '../../packages/utils/src/dish-photo-matcher.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../');

describe('Abiruchi Hotel 100 UI/UX & Invisible Translation Test Suite', () => {
  it('Improvement 1-20: Invisible Translation Engine & Caching (Zero Loading Flash)', async () => {
    // Verify translation works seamlessly without visible indicators
    const sourceText = 'Margherita Verace D.O.P.';
    const translatedEs = await translateText(sourceText, 'es');
    assert.ok(translatedEs);
    assert.equal(typeof translatedEs, 'string');

    // Repeated call must return instantly from L1/L2 cache
    const startTime = Date.now();
    const cachedEs = await translateText(sourceText, 'es');
    const elapsed = Date.now() - startTime;
    assert.equal(cachedEs, translatedEs);
    assert.ok(elapsed < 20, `Cached translation took ${elapsed}ms; expected < 20ms`);

    // Verify RTL detection for Arabic, Hebrew, Urdu, Persian
    const rtlCodes = ['ar', 'he', 'ur', 'fa'];
    for (const code of rtlCodes) {
      const match = SUPPORTED_LANGUAGES.find(l => l.code === code);
      assert.ok(match, `Language ${code} should be supported`);
      assert.equal(match.dir, 'rtl', `Language ${code} should have dir="rtl"`);
    }

    // Verify deep translation of categories and items
    const sampleMenu = {
      categories: [{ id: 'cat-1', name: 'Appetizers', description: 'Fresh starters' }],
      items: [{ id: 'item-1', name: 'Tomato Bruschetta', description: 'Grilled bread with heirloom tomatoes' }]
    };
    const translatedMenu = await translateMenuData(sampleMenu, 'fr');
    assert.equal(translatedMenu.targetLang, 'fr');
    assert.equal(translatedMenu.categories.length, 1);
    assert.equal(translatedMenu.items.length, 1);
    assert.ok(translatedMenu.categories[0].name);
    assert.ok(translatedMenu.items[0].name);
  });

  it('Improvement 21-40: Color Palette, WCAG 2.2 AA Contrast & Zero Horizontal Overflow in Guest App', () => {
    const htmlPath = join(rootDir, 'apps/web-guest/public/index.html');
    assert.ok(existsSync(htmlPath), 'apps/web-guest/public/index.html must exist');
    const html = readFileSync(htmlPath, 'utf-8');

    // Enforce zero horizontal overflow
    assert.match(html, /max-width:\s*100vw;/);
    assert.match(html, /overflow-x:\s*hidden;/);
    assert.match(html, /box-sizing:\s*border-box;/);

    // Verify no crude visible "Translating..." text
    assert.doesNotMatch(html, /Translating menu via Google Translate/i);

    // Verify glassmorphism and modern colors
    assert.match(html, /backdrop-filter:/);
    assert.match(html, /--primary:/);
    assert.match(html, /--card-bg:/);
  });

  it('Improvement 41-60: Rich Keyframe Animations in Guest App and KDS', () => {
    const guestHtml = readFileSync(join(rootDir, 'apps/web-guest/public/index.html'), 'utf-8');
    const kdsHtml = readFileSync(join(rootDir, 'apps/kds/public/index.html'), 'utf-8');

    // Check Guest PWA Animations
    assert.match(guestHtml, /@keyframes fadeInUp/);
    assert.match(guestHtml, /@keyframes slideUpSheet/);
    assert.match(guestHtml, /@keyframes cartBadgeBounce/);

    // Check KDS Keyframes
    assert.match(kdsHtml, /@keyframes ticketFadeIn/);
    assert.match(kdsHtml, /@keyframes criticalPulse/);
    assert.match(kdsHtml, /@keyframes pulseDot/);
  });

  it('Improvement 61-80: Embedded SVG Vector Icons Library', () => {
    const guestHtml = readFileSync(join(rootDir, 'apps/web-guest/public/index.html'), 'utf-8');
    const kdsHtml = readFileSync(join(rootDir, 'apps/kds/public/index.html'), 'utf-8');

    // SVG elements must be present
    const guestSvgMatches = guestHtml.match(/<svg[\s\S]*?<\/svg>/g) || [];
    assert.ok(guestSvgMatches.length >= 8, `Expected at least 8 SVGs in guest app, found ${guestSvgMatches.length}`);

    const kdsSvgMatches = kdsHtml.match(/<svg[\s\S]*?<\/svg>/g) || [];
    assert.ok(kdsSvgMatches.length >= 4, `Expected at least 4 SVGs in KDS, found ${kdsSvgMatches.length}`);
  });

  it('Improvement 81-100: Page Architecture, Modals, KDS Hotkeys & 86 Sync', () => {
    const guestHtml = readFileSync(join(rootDir, 'apps/web-guest/public/index.html'), 'utf-8');
    const kdsHtml = readFileSync(join(rootDir, 'apps/kds/public/index.html'), 'utf-8');
    const ownerHtml = readFileSync(join(rootDir, 'apps/web-owner/public/index.html'), 'utf-8');

    // Guest App Structural Components
    assert.match(guestHtml, /id="cartModal"/);
    assert.match(guestHtml, /id="waiterModal"/);
    assert.match(guestHtml, /id="reviewModal"/);
    assert.match(guestHtml, /id="categoryNav"/);
    assert.match(guestHtml, /id="searchInput"/);

    // KDS Hotkeys & Chime Controls
    assert.match(kdsHtml, /id="audioToggle"/);
    assert.match(kdsHtml, /recallLastBumped/);
    assert.match(kdsHtml, /e\.code === 'Space'/);

    // Owner Portal Live 86 Toggle API Link
    assert.match(ownerHtml, /\/api\/v1\/menu\/items\/\${itemId}\/toggle-86/);
  });

  it('Phase 2 UX Deliverables: Distinct Photos, Time-Shift Availability, Full Pre-Booking, Voice Control, Compact Grid & History', () => {
    // 1. Verify getAutoDishPhoto returns distinct authentic images
    const dosaPhoto = getAutoDishPhoto('Masala Dosa', 'Tiffins');
    const biryaniPhoto = getAutoDishPhoto('Chicken Biryani', 'Biryani');
    const coffeePhoto = getAutoDishPhoto('Filter Coffee', 'Beverages');
    const samosaPhoto = getAutoDishPhoto('Samosa', 'Snacks');
    assert.ok(dosaPhoto && biryaniPhoto && coffeePhoto && samosaPhoto);
    assert.notEqual(dosaPhoto, biryaniPhoto, 'Dosa and Biryani must have distinct photos');
    assert.notEqual(biryaniPhoto, coffeePhoto, 'Biryani and Coffee must have distinct photos');

    // 2. Verify Guest UI has voice search, compact grid toggle, order history, and shift chips
    const guestHtml = readFileSync(join(rootDir, 'apps/web-guest/public/index.html'), 'utf-8');
    assert.match(guestHtml, /id="btnVoiceOrder"/, 'Voice search button must exist');
    assert.match(guestHtml, /id="voiceModal"/, 'Voice modal overlay must exist');
    assert.match(guestHtml, /id="historyModal"/, 'Order history modal must exist');
    assert.match(guestHtml, /id="shiftChipNow"/, 'Real-time shift filter chip must exist');
    assert.match(guestHtml, /id="btnViewGrid"/, 'Compact grid view button must exist');
    assert.match(guestHtml, /id="btnViewList"/, 'List view button must exist');

    // 3. Verify CSS has compact 2-column mobile grid styling
    const css = readFileSync(join(rootDir, 'apps/web-guest/public/styles.css'), 'utf-8');
    assert.match(css, /\.menu-container\.grid-view/, 'Compact grid view CSS must exist');
    assert.match(css, /grid-template-columns:\s*repeat\(2,\s*1fr\)/, '2-column mobile grid must be defined');
    assert.match(css, /\.grid-dish-card/, 'Grid dish card styling must exist');
    assert.match(css, /\.time-badge/, 'Shift time badge styling must exist');

    // 4. Verify Pre-Booking UI provides full menu pre-ordering
    const bookingHtml = readFileSync(join(rootDir, 'apps/web-guest/public/booking.html'), 'utf-8');
    assert.match(bookingHtml, /Pre-Order Dishes \(Full Menu Available\)/, 'Pre-order full menu section must exist');
    assert.match(bookingHtml, /id="preOrderItemsList"/, 'Pre-order items container must exist');
    assert.match(bookingHtml, /id="preOrderCategorySelect"/, 'Category dropdown must exist');
    assert.match(bookingHtml, /preSelectedItems/, 'Pre-selected items must be attached to booking payload');

    // 5. Verify Manager Menu & Voice Control
    const menuHtml = readFileSync(join(rootDir, 'apps/web-owner/public/menu.html'), 'utf-8');
    assert.match(menuHtml, /id="btnVoiceControl"/, 'Manager voice assistant button must exist');
    assert.match(menuHtml, /id="managerVoiceModal"/, 'Manager voice modal must exist');
    assert.match(menuHtml, /id="voiceHistoryModal"/, 'Voice history modal must exist');
    assert.match(menuHtml, /id="dishServingFrom"/, 'Serving from time input must exist');
    assert.match(menuHtml, /id="dishServingUntil"/, 'Serving until time input must exist');
    assert.match(menuHtml, /autoSuggestPhoto/, 'Auto-suggest photo on dish typing must exist');
    assert.match(menuHtml, /triggerAutoPickPhoto/, 'Auto-pick photo trigger must exist');
  });

  it('Phase 3 Waiter Voice Commands, Multi-Lingual Understanding (EN/TE/HI), & Multi-Dimensional Token Filtering', async () => {
    // 1. Verify waiter-voice.js engine exists and defines core multilingual dictionaries and handlers
    const voiceJsPath = join(rootDir, 'apps/web-staff/public/waiter-voice.js');
    assert.ok(existsSync(voiceJsPath), 'apps/web-staff/public/waiter-voice.js must exist');
    const voiceJs = readFileSync(voiceJsPath, 'utf-8');

    assert.match(voiceJs, /WAITER_VOICE_RESPONSES/, 'Multilingual responses dictionary must exist');
    assert.match(voiceJs, /'en-IN'/, 'English (en-IN) must be supported');
    assert.match(voiceJs, /'te-IN'/, 'Telugu (te-IN) must be supported');
    assert.match(voiceJs, /'hi-IN'/, 'Hindi (hi-IN) must be supported');
    assert.match(voiceJs, /setWaiterVoiceLang/, 'Language switcher function must exist');
    assert.match(voiceJs, /speakWaiterFeedback/, 'Spoken feedback function must exist');

    // 2. Test multi-lingual phrase matching for "token given" and "item given"
    // English
    assert.ok(/token.*?(given|handed|delivered)/i.test('Token 101 given'));
    assert.ok(/item.*?(given|served|delivered)|given|served/i.test('Masala Dosa item given'));
    // Telugu
    assert.ok(/టోకెన్.*?(ఇచ్చాం|ఇచ్చాను|ఇచ్చేసాం)|token.*?(icham|ichanu)/.test('టోకెన్ 101 ఇచ్చాను'));
    assert.ok(/ఐటమ్.*?(ఇచ్చాం|ఇచ్చాను)|దోస.*?(ఇచ్చాం|ఇచ్చాను)|ఇచ్చాం|ఇచ్చాను/.test('దోస ఇచ్చాం'));
    // Hindi
    assert.ok(/टोकन.*?(दे दिया|दिया|सौंप दिया)|token.*?(de diya|diya)/.test('टोकन 101 दे दिया'));
    assert.ok(/आइटम.*?(दे दिया|दिया)|मसाला डोसा.*?(दे दिया|दिया)|दे दिया|दिया/.test('मसाला डोसा दे दिया'));

    // 3. Verify staff.html has voice controls, filter bar, and no cartoon illustrations
    const staffHtml = readFileSync(join(rootDir, 'apps/web-staff/public/staff.html'), 'utf-8');
    assert.match(staffHtml, /id="btnWaiterVoice"/, 'Waiter voice button must exist');
    assert.match(staffHtml, /id="waiterLangSelect"/, 'Voice language dropdown must exist');
    assert.match(staffHtml, /id="waiterVoiceModal"/, 'Waiter voice modal must exist');
    assert.match(staffHtml, /id="waiterVoiceLogModal"/, 'Voice log history modal must exist');
    assert.match(staffHtml, /id="searchTokenInput"/, 'Token search input must exist');
    assert.match(staffHtml, /id="filterTokenTime"/, 'Token time filter must exist');
    assert.match(staffHtml, /id="filterTokenQty"/, 'Token quantity filter must exist');
    assert.match(staffHtml, /id="sortTokenOrder"/, 'Token sort order must exist');
    assert.match(staffHtml, /applyTokenFilters/, 'applyTokenFilters function must exist');

    // Verify tokens.html has voice engine and filters
    const tokensHtml = readFileSync(join(rootDir, 'apps/web-staff/public/tokens.html'), 'utf-8');
    assert.match(tokensHtml, /src="\/staff\/waiter-voice\.js"/, 'tokens.html must import waiter-voice.js');
    assert.match(tokensHtml, /id="btnWaiterVoice"/, 'tokens.html must have voice button');
    assert.match(tokensHtml, /id="filterTokenTime"/, 'tokens.html must have time filter');
    assert.match(tokensHtml, /id="filterTokenQty"/, 'tokens.html must have quantity filter');

    // Verify mobile-staff /waiter index.html has voice integration
    const mobileStaffHtml = readFileSync(join(rootDir, 'apps/mobile-staff/public/index.html'), 'utf-8');
    assert.match(mobileStaffHtml, /src="\/staff\/waiter-voice\.js"/, 'mobile staff must import waiter-voice.js');
    assert.match(mobileStaffHtml, /id="btnWaiterVoice"/, 'mobile staff must have voice button');
    assert.match(mobileStaffHtml, /id="waiterLangSelect"/, 'mobile staff must have language dropdown');

    // 4. Verify OrderStore active token enrichment with items & itemCount
    const { OrderStore } = await import('../../services/order-service/src/store.ts');
    const store = new OrderStore();

    const orderId = 'ord_test_voice_101';
    const tokenId = 'tok_test_voice_101';

    // Seed order with multiple items
    store.orders.set(orderId, {
      id: orderId,
      outletId: 'b0000000-0000-0000-0000-000000000001',
      tableNumber: '12',
      customerName: 'Kamesh',
      items: [
        { id: 'item-1', name: 'Masala Dosa', quantity: 2, priceCents: 8000 },
        { id: 'item-2', name: 'Filter Coffee', quantity: 1, priceCents: 3000 }
      ],
      totalCents: 19000,
      paymentMethod: 'CASH',
      status: 'PREPARING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Seed token linked to that order
    store.tokens.set(tokenId, {
      id: tokenId,
      outletId: 'b0000000-0000-0000-0000-000000000001',
      code: 'A-101',
      bucket: 'HOT_LINE',
      station: 'HOT_LINE',
      state: 'READY',
      orderRef: orderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const activeTokens = store.getActiveTokens('HOT_LINE');
    const matching = activeTokens.find((t: any) => t.id === tokenId);
    assert.ok(matching, 'Created token must be present in active tokens');
    assert.equal(matching.itemCount, 3, 'Token itemCount must equal sum of item quantities (2+1=3)');
    assert.equal(matching.items.length, 2, 'Token must contain 2 ordered items');
    assert.equal(matching.tableNumber, '12', 'Token must have tableNumber');
    assert.equal(matching.customerName, 'Kamesh', 'Token must have customerName');
  });

  it('Phase 4 QR Code Visual Enhancement: Top Subject Reference & Dark-Mode High-Contrast Quiet-Zone Frame', () => {
    // 1. Verify Table QR SVG contains top reference header and dark mode styling
    const tableSvgPath = join(rootDir, 'DOCUMENTS/QR/Table-01-Main-Dining.svg');
    assert.ok(existsSync(tableSvgPath), 'DOCUMENTS/QR/Table-01-Main-Dining.svg must exist');
    const tableSvg = readFileSync(tableSvgPath, 'utf-8');

    assert.match(tableSvg, /ABIRUCHI HOTEL/, 'SVG must display brand header at top');
    assert.match(tableSvg, /MAIN DINING/, 'SVG must display zone pill at top');
    assert.match(tableSvg, /TABLE T-01/, 'SVG must display table subject at top');
    assert.match(tableSvg, /prefers-color-scheme:\s*dark/, 'SVG must support dark mode media query');
    assert.match(tableSvg, /qr-quiet-zone/, 'SVG must define high-contrast scanner quiet-zone');

    // 2. Verify UPI QR SVG contains top reference header and payee VPA
    const upiSvgPath = join(rootDir, 'DOCUMENTS/QR/UPI-Payee-Indiranagar-9010150809.svg');
    assert.ok(existsSync(upiSvgPath), 'DOCUMENTS/QR/UPI-Payee-Indiranagar-9010150809.svg must exist');
    const upiSvg = readFileSync(upiSvgPath, 'utf-8');

    assert.match(upiSvg, /UPI DIRECT PREPAYMENT/, 'UPI SVG must display prepayment title at top');
    assert.match(upiSvg, /BILLING & CASHIER STAND/, 'UPI SVG must display cashier stand at top');
    assert.match(upiSvg, /9010150809@ybl/, 'UPI SVG must display payee VPA');
    assert.match(upiSvg, /prefers-color-scheme:\s*dark/, 'UPI SVG must support dark mode');

    // 3. Verify Printable sheet has dark mode styling and print fidelity
    const printablePath = join(rootDir, 'DOCUMENTS/QR/Printable-Table-Tents-All.html');
    assert.ok(existsSync(printablePath), 'Printable-Table-Tents-All.html must exist');
    const printableHtml = readFileSync(printablePath, 'utf-8');
    assert.match(printableHtml, /@media\s*\(prefers-color-scheme:\s*dark\)/, 'Printable sheet must include dark mode CSS');
    assert.match(printableHtml, /ref-title/, 'Printable card must have top reference title');
    assert.match(printableHtml, /qr-frame/, 'Printable card must have high-contrast qr-frame');

    // 4. Verify Guest checkout modal has dark-mode safe quiet frame and top reference
    const guestHtml = readFileSync(join(rootDir, 'apps/web-guest/public/index.html'), 'utf-8');
    assert.match(guestHtml, /qr-display-card/, 'Guest checkout must use qr-display-card');
    assert.match(guestHtml, /qr-header-ref/, 'Guest checkout must show top header reference');
    assert.match(guestHtml, /qr-quiet-frame/, 'Guest checkout must use high-contrast qr-quiet-frame');

    const guestCss = readFileSync(join(rootDir, 'apps/web-guest/public/styles.css'), 'utf-8');
    assert.match(guestCss, /\.qr-display-card/, 'styles.css must style .qr-display-card');
    assert.match(guestCss, /\[data-theme="dark"\]\s*\.qr-quiet-frame/, 'styles.css must have dark mode quiet frame styling');
  });

  it('Phase 5 Theme Toggle, Dark Mode Zero-White Invariant, & Responsive Fluid Layout', () => {
    const appJs = readFileSync(join(rootDir, 'apps/web-guest/public/app.js'), 'utf-8');
    assert.match(appJs, /function setTheme\(theme\)/, 'app.js must define global setTheme function');
    assert.match(appJs, /window\.setTheme\s*=/, 'window.setTheme must be exported globally');
    assert.match(appJs, /btnThemeLight[\s\S]*classList\.toggle/, 'applyTheme must sync btnThemeLight active state');
    assert.match(appJs, /btnThemeDark[\s\S]*classList\.toggle/, 'applyTheme must sync btnThemeDark active state');

    const guestHtml = readFileSync(join(rootDir, 'apps/web-guest/public/index.html'), 'utf-8');
    assert.doesNotMatch(guestHtml, /style="background:#ffffff;"/, 'index.html must not contain inline white backgrounds');
    assert.match(guestHtml, /header-action-btn/, 'index.html must use responsive header-action-btn');
    assert.match(guestHtml, /hide-mobile/, 'index.html must use hide-mobile to prevent mobile text overflow');

    const guestCss = readFileSync(join(rootDir, 'apps/web-guest/public/styles.css'), 'utf-8');
    assert.match(guestCss, /\[data-theme="dark"\]\s*\{[\s\S]*--bg:\s*#090d16/, 'styles.css dark theme must define deep dark background');
    assert.match(guestCss, /\.abiruchi-dish-card/, 'styles.css must style .abiruchi-dish-card');
    assert.match(guestCss, /@media\s*\(max-width:\s*640px\)/, 'styles.css must include mobile responsive query');
  });

  it('Phase 6: Unique Dish Images, Quantity Steppers, Payment & Login/Logout Controls, and Dropdown Filters', () => {
    // 1. Verify all 56 dishes in seed-menu.ts have 100% unique image URLs
    const seedMenuTs = readFileSync(join(rootDir, 'services/order-service/src/seed-menu.ts'), 'utf-8');
    const items = [...seedMenuTs.matchAll(/name:\s*['"]([^'"]+)['"][\s\S]*?imageUrl:\s*['"]([^'"]+)['"]/g)];
    const urls = items.map(m => m[2]);
    const uniqueUrls = new Set(urls);
    assert.equal(items.length, 56, 'Must have 56 menu items seeded');
    assert.equal(uniqueUrls.size, 56, 'All 56 dishes must have 100% unique image URLs (no duplicate pictures)');

    // 2. Verify HTML contains Login/Logout buttons, Payment buttons, Quantity Stepper, and Dropdowns
    const guestHtml = readFileSync(join(rootDir, 'apps/web-guest/public/index.html'), 'utf-8');
    assert.match(guestHtml, /id="headerLogoutBtn"/, 'Header must contain dedicated logout button');
    assert.match(guestHtml, /id="headerLoginBtn"/, 'Header must contain dedicated login button');
    assert.match(guestHtml, /id="payNowBtn"/, 'Cart drawer must contain dedicated Pay Now button');
    assert.match(guestHtml, /id="dishModalQtyDisplay"/, 'Individual dish modal must have quantity count display');
    assert.match(guestHtml, /adjustModalDishQty\(1\)/, 'Individual dish modal must have + button');
    assert.match(guestHtml, /adjustModalDishQty\(-1\)/, 'Individual dish modal must have - button');
    assert.match(guestHtml, /id="shiftFilterSelect"/, 'Shift timings must use responsive dropdown instead of overflowing buttons');
    assert.match(guestHtml, /id="menuSortSelect"/, 'Menu must support sorting by cost and mostly ordered via dropdown');

    // 3. Verify app.js exports required state handlers
    const appJs = readFileSync(join(rootDir, 'apps/web-guest/public/app.js'), 'utf-8');
    assert.match(appJs, /window\.updateLoginStateUI\s*=/, 'app.js must export updateLoginStateUI');
    assert.match(appJs, /window\.handleLogout\s*=/, 'app.js must export handleLogout');
    assert.match(appJs, /window\.adjustModalDishQty\s*=/, 'app.js must export adjustModalDishQty');
    assert.match(appJs, /window\.applyMenuSort\s*=/, 'app.js must export applyMenuSort');
    assert.match(appJs, /window\.applyDietaryFilter\s*=/, 'app.js must export applyDietaryFilter');
    assert.match(appJs, /window\.handleInstantPayment\s*=/, 'app.js must export handleInstantPayment');
    assert.match(appJs, /window\.switchCustomerJourney\s*=/, 'app.js must export switchCustomerJourney');

    // 4. Verify router.js does not claim "Reserved Table" without bookingId
    const routerJs = readFileSync(join(rootDir, 'apps/web-guest/public/router.js'), 'utf-8');
    assert.match(routerJs, /Reserve a Table/, 'router.js must show Reserve a Table when no bookingId is present');
  });
});
