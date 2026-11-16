import test from 'node:test';
import assert from 'node:assert/strict';
import { ConversationalWaiterAgent } from '../../packages/agents/waiter-agent/src/index.ts';
import type { MenuItem } from '../../packages/shared-types/src/index.ts';

test('Conversational AI Waiter Agent', async (t) => {
  const sampleMenu: MenuItem[] = [
    {
      id: 'm1',
      tenantId: 't1',
      outletId: 'o1',
      categoryId: 'c1',
      name: 'Truffle Burrata',
      description: 'Fresh burrata with black truffle',
      basePriceCents: 1850,
      allergens: ['dairy'],
      isAvailable: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'm2',
      tenantId: 't1',
      outletId: 'o1',
      categoryId: 'c2',
      name: 'Margherita Pizza',
      description: 'San Marzano tomatoes and fior di latte',
      basePriceCents: 1900,
      allergens: ['gluten', 'dairy'],
      isAvailable: true,
      modifierGroups: [
        {
          id: 'mg1',
          name: 'Crust',
          minSelect: 1,
          maxSelect: 1,
          options: [{ id: 'opt1', name: 'Gluten-Free Artisan Crust', priceDeltaCents: 350, isDefault: false }],
        },
      ],
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'm3',
      tenantId: 't1',
      outletId: 'o1',
      categoryId: 'c3',
      name: 'Blood Orange Spritz',
      description: 'Refreshing Italian cocktail',
      basePriceCents: 1400,
      allergens: [],
      isAvailable: true,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const agent = new ConversationalWaiterAgent(sampleMenu);

  await t.test('Identifies and recommends gluten-safe options', () => {
    const res = agent.handleGuestQuery('Do you have anything gluten free or celiac friendly?');
    assert.equal(res.type, 'SAFE_OPTIONS');
    assert.ok(res.recommendedItems.some((i) => i.name === 'Margherita Pizza')); // Has GF mod option
    assert.ok(res.recommendedItems.some((i) => i.name === 'Blood Orange Spritz')); // No gluten
  });

  await t.test('Filters dairy allergens strictly', () => {
    const res = agent.handleGuestQuery('I am severely lactose intolerant, dairy free only please');
    assert.equal(res.type, 'SAFE_OPTIONS');
    assert.equal(res.recommendedItems.some((i) => i.name === 'Truffle Burrata'), false);
    assert.equal(res.recommendedItems.some((i) => i.name === 'Margherita Pizza'), false);
    assert.equal(res.recommendedItems.some((i) => i.name === 'Blood Orange Spritz'), true);
  });

  await t.test('Provides beverage pairing upsell recommendations', () => {
    const res = agent.handleGuestQuery('What cocktail or wine do you recommend with dinner?');
    assert.equal(res.type, 'PAIRING_UPSELL');
    assert.ok(res.recommendedItems.some((i) => i.name === 'Blood Orange Spritz'));
  });
});
