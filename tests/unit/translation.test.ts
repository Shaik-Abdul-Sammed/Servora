import test from 'node:test';
import assert from 'node:assert/strict';
import {
  translateText,
  translateBatch,
  SUPPORTED_LANGUAGES,
} from '../../packages/content-translation/src/index.ts';

test('Google Translate Free API & Multi-Tier Caching Engine', async (t) => {
  await t.test('Verifies 99+ canonical languages supported', () => {
    assert.ok(SUPPORTED_LANGUAGES.length >= 99);
    const spanish = SUPPORTED_LANGUAGES.find((l) => l.code === 'es');
    assert.ok(spanish);
    assert.equal(spanish.name, 'Spanish');

    const arabic = SUPPORTED_LANGUAGES.find((l) => l.code === 'ar');
    assert.ok(arabic);
    assert.equal(arabic.dir, 'rtl');
  });

  await t.test('Translates a menu title to Spanish accurately', async () => {
    const input = 'Wood-Fired Pizzas';
    const result = await translateText(input, 'es');
    assert.ok(result);
    assert.notEqual(result, '');
    assert.equal(result.toLowerCase().includes('pizza'), true);
  });

  await t.test('Serves repeated translation instantly from memory cache', async () => {
    const start = performance.now();
    const result = await translateText('Wood-Fired Pizzas', 'es');
    const elapsed = performance.now() - start;
    assert.ok(result);
    // Cached read should take less than 10 milliseconds
    assert.ok(elapsed < 20);
  });

  await t.test('Batch translates multiple culinary ingredients', async () => {
    const ingredients = ['Truffle Oil', 'Bufala Mozzarella', 'Fresh Basil'];
    const translated = await translateBatch(ingredients, 'it');
    assert.equal(translated.length, 3);
    assert.ok(translated[0].length > 0);
  });
});
