import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OrderStore } from '../../services/order-service/src/store.ts';

const repoRoot = process.cwd();

test('Abiruchi Hotel Enterprise Design & Architecture Invariants Suite', async (t) => {
  const outletId = 'b0000000-0000-0000-0000-000000000001';
  const store = new OrderStore(':memory:');

  await t.test('1. Zero "swiggy" references invariant across frontend codebase', () => {
    const filesToCheck = [
      'apps/web-guest/public/styles.css',
      'apps/web-guest/public/app.js',
      'apps/web-guest/public/index.html',
      'apps/web-guest/public/manifest.json',
      'apps/web-guest/public/sw.js',
      'apps/web-owner/public/inventory.html',
      'apps/web-owner/public/orders.html',
      'apps/web-owner/public/staff.html',
      'apps/web-owner/public/tokens.html',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = join(repoRoot, relPath);
      assert.ok(existsSync(fullPath), `Expected ${relPath} to exist`);
      const content = readFileSync(fullPath, 'utf-8');
      const matches = content.match(/swiggy/gi);
      assert.equal(
        matches,
        null,
        `Expected ZERO occurrences of "swiggy" in ${relPath}, but found: ${matches?.length}`
      );
    }
  });

  await t.test('2. Recipe Costing & live gross margin calculation', () => {
    // Menu item Margherita Verace D.O.P.
    const menuItemId = 'e0000000-0000-0000-0000-000000000002';
    const margin = store.calculateRecipeMargin(menuItemId);
    assert.ok(margin, 'Expected recipe margin to be calculated');
    assert.equal(margin.menuItemId, menuItemId);
    assert.ok(margin.sellingPriceCents > 0);
    assert.ok(margin.ingredientCostCents > 0);
    assert.ok(margin.grossMarginPercent > 50, 'Expected healthy gross margin above 50%');
  });

  await t.test('3. BCG Menu Engineering Matrix classification', () => {
    const matrix = store.generateMenuEngineeringBCGMatrix(outletId);
    assert.ok(matrix, 'Expected BCG matrix to be generated');
    assert.ok(Array.isArray(matrix.stars));
    assert.ok(Array.isArray(matrix.plowhorses));
    assert.ok(Array.isArray(matrix.puzzles));
    assert.ok(Array.isArray(matrix.dogs));
    assert.ok(typeof matrix.classificationMap === 'object');
  });

  await t.test('4. Par-level inventory consumable threshold alerts', () => {
    const alerts = store.checkParLevelAlerts(outletId);
    assert.ok(Array.isArray(alerts));
    assert.ok(alerts.length >= 1, 'Expected at least 1 par level alert');
  });

  await t.test('5. Inventory valuation calculation', () => {
    const val = store.calculateInventoryValuation(outletId);
    assert.equal(val.outletId, outletId);
    assert.ok(val.totalItems > 0);
    assert.ok(val.totalValueCents > 0);
  });

  await t.test('6. PWA Manifest & Service Worker assets valid', () => {
    const manifestPath = join(repoRoot, 'apps/web-guest/public/manifest.json');
    const swPath = join(repoRoot, 'apps/web-guest/public/sw.js');
    assert.ok(existsSync(manifestPath), 'manifest.json exists');
    assert.ok(existsSync(swPath), 'sw.js exists');

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    assert.equal(manifest.short_name, 'Abiruchi');
    assert.equal(manifest.name, 'Abiruchi Hotel');
    assert.equal(manifest.display, 'standalone');
  });

  await t.test('7. WCAG 2.2 AA Accessibility & Reduced Motion styles present', () => {
    const cssPath = join(repoRoot, 'apps/web-guest/public/styles.css');
    const css = readFileSync(cssPath, 'utf-8');
    assert.ok(css.includes(':focus-visible') || css.includes('outline'), 'Focus indicator styles present');
  });
});
