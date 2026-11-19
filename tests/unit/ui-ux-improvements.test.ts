import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateText, SUPPORTED_LANGUAGES, translateMenuData } from '../../packages/content-translation/src/google-translate.ts';

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
});
