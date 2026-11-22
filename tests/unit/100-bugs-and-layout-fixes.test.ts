import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('100 Bugs, Layout, and Typo Fixes Verification Suite', () => {
  const rootDir = path.resolve(__dirname, '../../');

  it('Bug #1: web-guest index.html has exact <div> open and close tag balance', () => {
    const html = fs.readFileSync(path.join(rootDir, 'apps/web-guest/public/index.html'), 'utf8');
    const openDivs = (html.match(/<div(\s+[^>]*)?>/gi) || []).length;
    const closeDivs = (html.match(/<\/div>/gi) || []).length;
    assert.strictEqual(openDivs, closeDivs, `Mismatched <div> tags: ${openDivs} open vs ${closeDivs} close`);
  });

  it('Bug #2: web-guest styles.css has correct z-index hierarchy preventing overlay interception', () => {
    const css = fs.readFileSync(path.join(rootDir, 'apps/web-guest/public/styles.css'), 'utf8');
    assert.match(css, /\.abiruchi-floating-cart-bar\s*\{[^}]*z-index:\s*80/s);
    assert.match(css, /\.sheet-overlay\s*\{[^}]*z-index:\s*1000/s);
    assert.match(css, /\.toast\s*\{[^}]*z-index:\s*2000/s);
  });

  it('Bug #3: web-guest styles.css includes iOS safe-area-inset-bottom in floating cart bar', () => {
    const css = fs.readFileSync(path.join(rootDir, 'apps/web-guest/public/styles.css'), 'utf8');
    assert.match(css, /bottom:\s*calc\(16px\s*\+\s*env\(safe-area-inset-bottom/);
  });

  it('Bug #4: web-guest styles.css constrains portals dropdown width to avoid 320px viewport overflow', () => {
    const css = fs.readFileSync(path.join(rootDir, 'apps/web-guest/public/styles.css'), 'utf8');
    assert.match(css, /\.portals-dropdown-menu\s*\{[^}]*width:\s*min\(320px,\s*calc\(100vw\s*-\s*24px\)\)/s);
  });

  it('Bug #5: web-guest styles.css defines .active-glutenfree pill styling', () => {
    const css = fs.readFileSync(path.join(rootDir, 'apps/web-guest/public/styles.css'), 'utf8');
    assert.match(css, /\.abiruchi-pill-toggle\.active-glutenfree/);
  });

  it('Bug #6-10: All 5 marketing landing pages include responsive @media (max-width: 768px) mobile styling', () => {
    const marketingPages = [
      'apps/marketing/public/index.html',
      'apps/marketing/public/for-cafes.html',
      'apps/marketing/public/for-bars.html',
      'apps/marketing/public/for-restaurants.html',
      'apps/marketing/public/pricing.html',
    ];

    for (const relPath of marketingPages) {
      const content = fs.readFileSync(path.join(rootDir, relPath), 'utf8');
      assert.ok(content.includes('@media (max-width: 768px)'), `${relPath} missing mobile media query`);
      assert.match(content, /(?:\.hero\s+)?h1\s*\{[^}]*font-size:\s*2rem/s, `${relPath} missing responsive hero h1 font scaling`);
    }
  });

  it('Bug #11: web-guest receipt.html has packaging charge and dynamic tax label rows', () => {
    const html = fs.readFileSync(path.join(rootDir, 'apps/web-guest/public/receipt.html'), 'utf8');
    assert.ok(html.includes('id="packagingRow"'), 'receipt.html missing #packagingRow');
    assert.ok(html.includes('id="packagingVal"'), 'receipt.html missing #packagingVal');
    assert.ok(html.includes('id="taxLabel"'), 'receipt.html missing #taxLabel');
  });

  it('Bug #12: web-owner manager.html embedded scripts parse with zero syntax errors', () => {
    const html = fs.readFileSync(path.join(rootDir, 'apps/web-owner/public/manager.html'), 'utf8');
    const scripts = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi) || [];
    assert.ok(scripts.length > 0, 'No inline scripts found in manager.html');
    for (const tag of scripts) {
      const code = tag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
      assert.doesNotThrow(() => {
        new vm.Script(code);
      }, 'Syntax error detected in manager.html script block');
    }
  });

  it('Bug #13: web-guest app.js provides both closeDishDetailModal and closeDishDetailsModal aliases', () => {
    const js = fs.readFileSync(path.join(rootDir, 'apps/web-guest/public/app.js'), 'utf8');
    assert.match(js, /function\s+closeDishDetailModal\s*\(/);
    assert.match(js, /window\.closeDishDetailsModal\s*=\s*closeDishDetailsModal/);
  });

  it('Bug #14: web-guest app.js corrects Mains Course typo to Main Course in UI translations', () => {
    const js = fs.readFileSync(path.join(rootDir, 'apps/web-guest/public/app.js'), 'utf8');
    assert.ok(!js.includes("mains: 'Mains Course'"), 'Grammar typo Mains Course still present in UI translations');
    assert.ok(js.includes("mains: 'Main Course'"), 'Corrected Main Course not found in UI translations');
  });

  it('Bug #15: web-owner owner.html links Staff directly to /owner/staff and provides Inventory link', () => {
    const html = fs.readFileSync(path.join(rootDir, 'apps/web-owner/public/owner.html'), 'utf8');
    assert.ok(html.includes('href="/owner/staff"'), 'owner.html missing link to /owner/staff');
    assert.ok(html.includes('href="/owner/inventory"'), 'owner.html missing link to /owner/inventory');
  });

  it('Bug #16: web-owner shared.js includes Manager & GST Hub and Inventory in sidebar nav for all outlet types', () => {
    const js = fs.readFileSync(path.join(rootDir, 'apps/web-owner/public/shared.js'), 'utf8');
    assert.ok(js.includes("href: '/manager'"), 'shared.js missing /manager nav item');
    assert.ok(js.includes("href: '/owner/inventory'"), 'shared.js missing /owner/inventory nav item');
  });
});
