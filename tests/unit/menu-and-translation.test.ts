import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_CATEGORIES, createSeedMenuItems } from '../../services/order-service/src/seed-menu.ts';
import { OrderStore } from '../../services/order-service/src/store.ts';
import { translateMenuData } from '../../packages/content-translation/src/index.ts';

test('Indian Restaurant Menu (50+ Items) & Multilingual Engine', async (t) => {
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const outletId = 'b0000000-0000-0000-0000-000000000001';
  const store = new OrderStore();
  store.seedDemoData();

  await t.test('Verifies at least 50 menu items across 5 core Indian categories', () => {
    const items = createSeedMenuItems(tenantId, outletId);
    assert.ok(items.length >= 50, `Expected at least 50 items, got ${items.length}`);
    assert.equal(items.length, 56);

    const categories = SEED_CATEGORIES.map(c => c.name);
    assert.ok(categories.includes('Tiffins'));
    assert.ok(categories.includes('Lunch'));
    assert.ok(categories.includes('Dinner'));
    assert.ok(categories.includes('Snacks'));
    assert.ok(categories.includes('Cool Drinks'));
  });

  await t.test('Verifies item distribution across required categories', () => {
    const items = createSeedMenuItems(tenantId, outletId);
    const catMap = new Map(SEED_CATEGORIES.map(c => [c.id, c.name]));

    const tiffins = items.filter(i => catMap.get(i.categoryId) === 'Tiffins');
    const lunch = items.filter(i => catMap.get(i.categoryId) === 'Lunch');
    const dinner = items.filter(i => catMap.get(i.categoryId) === 'Dinner');
    const snacks = items.filter(i => catMap.get(i.categoryId) === 'Snacks');
    const coolDrinks = items.filter(i => catMap.get(i.categoryId) === 'Cool Drinks');

    assert.ok(tiffins.length >= 12, `Tiffins should have at least 12 items, found ${tiffins.length}`);
    assert.ok(lunch.length >= 12, `Lunch should have at least 12 items, found ${lunch.length}`);
    assert.ok(dinner.length >= 10, `Dinner should have at least 10 items, found ${dinner.length}`);
    assert.ok(snacks.length >= 8, `Snacks should have at least 8 items, found ${snacks.length}`);
    assert.ok(coolDrinks.length >= 8, `Cool Drinks should have at least 8 items, found ${coolDrinks.length}`);
  });

  await t.test('Verifies items have proper INR pricing, stations, and dietary indicators', () => {
    const items = createSeedMenuItems(tenantId, outletId);
    for (const item of items) {
      assert.ok(item.basePriceCents > 0, `Item ${item.name} must have positive price`);
      assert.ok(item.station, `Item ${item.name} must have a designated kitchen station`);
      assert.ok(item.dietaryType, `Item ${item.name} must have dietary indicator`);
      assert.ok(['VEG', 'NON_VEG', 'EGG', 'VEGAN'].includes(item.dietaryType!));
    }
  });

  await t.test('Translates menu items accurately into Telugu (te)', async () => {
    const menu = { categories: SEED_CATEGORIES, items: createSeedMenuItems(tenantId, outletId) };
    const res = await translateMenuData(menu, 'te');
    assert.equal(res.targetLang, 'te');
    assert.ok(res.categories.length > 0);
    assert.ok(res.items.length >= 50);

    const plainIdli = res.items.find(i => i.id === 'e0000000-0000-0000-0000-000000000010');
    assert.ok(plainIdli);
    assert.equal(plainIdli.name, 'సాదా ఇడ్లీ');
  });

  await t.test('Translates menu items accurately into Hindi (hi)', async () => {
    const menu = { categories: SEED_CATEGORIES, items: createSeedMenuItems(tenantId, outletId) };
    const res = await translateMenuData(menu, 'hi');
    assert.equal(res.targetLang, 'hi');
    const plainIdli = res.items.find(i => i.id === 'e0000000-0000-0000-0000-000000000010');
    assert.ok(plainIdli);
    assert.equal(plainIdli.name, 'सादा इडली');
  });

  await t.test('Verifies water bottle configuration in order store', () => {
    const settings = store.getWaterBottleSettings(outletId);
    assert.ok(settings);
    assert.equal(settings.enabled, true);
    assert.equal(settings.priceCents, 2000);

    const updated = store.updateWaterBottleSettings(outletId, { enabled: false, priceCents: 2500 });
    assert.equal(updated.enabled, false);
    assert.equal(updated.priceCents, 2500);

    // Reset back
    store.updateWaterBottleSettings(outletId, { enabled: true, priceCents: 2000 });
  });
});
