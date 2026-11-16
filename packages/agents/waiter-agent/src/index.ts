import type { MenuItem } from '../../../shared-types/src/index.ts';

export interface AgentRecommendation {
  type: 'SAFE_OPTIONS' | 'PAIRING_UPSELL' | 'GENERAL_ADVICE';
  message: string;
  recommendedItems: MenuItem[];
}

export class ConversationalWaiterAgent {
  private menu: MenuItem[];

  constructor(menu: MenuItem[]) {
    this.menu = menu;
  }

  /**
   * Evaluates guest input against allergens, preferences, and dietary restrictions.
   */
  public handleGuestQuery(query: string): AgentRecommendation {
    const lower = query.toLowerCase();

    // 1. Dietary restriction: Gluten / Celiac
    if (lower.includes('gluten') || lower.includes('celiac')) {
      const glutenFreeItems = this.menu.filter((item) => {
        // Safe if no gluten, or has gluten-free modifier option
        const hasGluten = item.allergens.includes('gluten');
        const hasGfMod = item.modifierGroups?.some((g) =>
          g.options.some((o) => o.name.toLowerCase().includes('gluten-free'))
        );
        return !hasGluten || hasGfMod;
      });

      return {
        type: 'SAFE_OPTIONS',
        message: 'Here are our dishes that are either naturally gluten-free or customizable with an artisan gluten-free crust:',
        recommendedItems: glutenFreeItems,
      };
    }

    // 2. Dietary restriction: Dairy / Lactose
    if (lower.includes('dairy') || lower.includes('lactose') || lower.includes('vegan')) {
      const dairyFreeItems = this.menu.filter((item) => !item.allergens.includes('dairy'));
      return {
        type: 'SAFE_OPTIONS',
        message: 'Here are our delicious dairy-free selections:',
        recommendedItems: dairyFreeItems,
      };
    }

    // 3. Pairing / Drink recommendation
    if (lower.includes('drink') || lower.includes('pair') || lower.includes('wine') || lower.includes('cocktail')) {
      const beverages = this.menu.filter((i) => i.basePriceCents < 1600 && i.allergens.length === 0);
      return {
        type: 'PAIRING_UPSELL',
        message: 'May I recommend our refreshing Sicilian Blood Orange Spritz? It pairs beautifully with our pizzas and pastas:',
        recommendedItems: beverages,
      };
    }

    // 4. General house recommendations
    const popular = this.menu.filter((i) => i.isAvailable).slice(0, 3);
    return {
      type: 'GENERAL_ADVICE',
      message: "Here are today's chef specials and guest favorites crafted fresh in our kitchen:",
      recommendedItems: popular,
    };
  }
}
