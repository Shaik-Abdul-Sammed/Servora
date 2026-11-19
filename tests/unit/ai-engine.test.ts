import test from 'node:test';
import assert from 'node:assert/strict';
import { AbiruchiHotelAIEngine } from '../../services/ai-service/src/ai-engine.ts';
import type { MenuItem } from '../../packages/shared-types/src/index.ts';

test('Abiruchi Hotel AI Automation Suite Engine', async (t) => {
  const ai = new AbiruchiHotelAIEngine();

  const mockCatalog: MenuItem[] = [
    {
      id: 'item_pizza',
      tenantId: 't1',
      outletId: 'o1',
      categoryId: 'c1',
      name: 'Wood-Fired Margherita Pizza',
      description: 'Classic pizza',
      basePriceCents: 1900,
      allergens: ['gluten', 'dairy'],
      isAvailable: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'item_spritz',
      tenantId: 't1',
      outletId: 'o1',
      categoryId: 'c2',
      name: 'Sicilian Blood Orange Spritz',
      description: 'Italian cocktail',
      basePriceCents: 1400,
      allergens: [],
      isAvailable: true,
      createdAt: '',
      updatedAt: '',
    },
  ];

  await t.test('Feature 1: AI Smart Upsell detects food-drink pairing opportunities', () => {
    // Diner has pizza but no beverage
    const upsells = ai.generateCartUpsells(['item_pizza'], mockCatalog);
    assert.equal(upsells.length, 1);
    assert.equal(upsells[0]?.name, 'Sicilian Blood Orange Spritz');
    assert.match(upsells[0]?.reason || '', /Spritz/);

    // If beverage is already in cart, no duplicate beverage upsell
    const noUpsell = ai.generateCartUpsells(['item_pizza', 'item_spritz'], mockCatalog);
    assert.equal(noUpsell.length, 0);
  });

  await t.test('Feature 2: AI Predictive Inventory & 86 Item Depletion Forecaster', () => {
    const inventory = [
      { name: 'Fresh Mozzarella', currentStock: 6.0, hourlyUsage: 3.0 }, // 2.0h -> Critical
      { name: 'Tomato Pelati', currentStock: 30.0, hourlyUsage: 5.0 }, // 6.0h -> Healthy
    ];

    const predictions = ai.predictDepletion(inventory);
    assert.equal(predictions[0]?.ingredient, 'Fresh Mozzarella');
    assert.equal(predictions[0]?.riskLevel, 'CRITICAL_STOCKOUT_RISK');
    assert.equal(predictions[0]?.projectedHoursRemaining, 2.0);
    assert.match(predictions[0]?.recommendedAction || '', /86 Risk/);

    assert.equal(predictions[1]?.riskLevel, 'HEALTHY');
  });

  await t.test('Feature 3: AI Customer Retention Copilot generates multilingual win-back campaign', () => {
    const campaign = ai.generateWinBackCampaign({
      name: 'Priya',
      phone: '+91 98765 43210',
      daysSinceLastVisit: 14,
      favoriteDish: 'Truffle Burrata',
    });

    assert.ok(campaign.promoCode.startsWith('COMEBACK'));
    assert.equal(campaign.channel, 'WHATSAPP');
    assert.match(campaign.messageText.en, /Hi Priya/);
    assert.match(campaign.messageText.hi, /नमस्ते Priya/);
    assert.match(campaign.messageText.te, /నమస్కారం Priya/);
  });

  await t.test('Feature 4: AI Multilingual Dietary Concierge in English, Hindi, and Telugu', () => {
    // English query
    const enRes = ai.answerDietaryQuery('Is there anything gluten free?', 'en', mockCatalog);
    assert.match(enRes.message, /gluten-free/);

    // Hindi query
    const hiRes = ai.answerDietaryQuery('क्या आपके पास ग्लूटेन मुक्त पिज्जा है?', 'hi', mockCatalog);
    assert.match(hiRes.message, /ग्लूटेन-मुक्त/);

    // Telugu query
    const teRes = ai.answerDietaryQuery('గ్లూటెన్ లేని ఆహారం ఉందా?', 'te', mockCatalog);
    assert.match(teRes.message, /గ్లూటెన్ లేని/);
  });

  await t.test('Feature 5: AI Dynamic Flash Pricing & Happy Hour Yield Optimizer', () => {
    // 4 PM (16:00), 30% occupancy -> Happy Hour deal active
    const happyHour = ai.evaluateDynamicPricing(30, 16);
    assert.equal(happyHour.status, 'ACTIVE');
    assert.equal(happyHour.discountPercent, 20);

    // 8 PM (20:00), dinner peak -> Standard pricing
    const regular = ai.evaluateDynamicPricing(85, 20);
    assert.equal(regular.status, 'STANDBY');
    assert.equal(regular.discountPercent, 0);
  });
});
