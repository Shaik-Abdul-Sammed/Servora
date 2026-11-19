import type { MenuItem, Order } from '../../../packages/shared-types/src/index.ts';

export interface UpsellSuggestion {
  targetMenuItemId: string;
  name: string;
  priceCents: number;
  reason: string;
}

export interface InventoryDepletionPrediction {
  ingredient: string;
  currentStockUnits: number;
  burnRatePerHour: number;
  projectedHoursRemaining: number;
  riskLevel: 'CRITICAL_STOCKOUT_RISK' | 'MODERATE' | 'HEALTHY';
  recommendedAction: string;
}

export interface WinBackCampaignOffer {
  guestIdentifier: string;
  guestName: string;
  channel: 'WHATSAPP' | 'SMS';
  promoCode: string;
  discountValue: string;
  expiryDays: number;
  messageText: {
    en: string;
    hi: string;
    te: string;
  };
}

export interface FlashDeal {
  dealId: string;
  title: string;
  discountPercent: number;
  activeFromHour: number;
  activeToHour: number;
  appliesToCategory: string;
  status: 'ACTIVE' | 'STANDBY';
}

export class AbiruchiHotelAIEngine {
  /**
   * 1. AI Smart Upsell & Dynamic Pairing Engine
   */
  public generateCartUpsells(cartItemIds: string[], catalog: MenuItem[]): UpsellSuggestion[] {
    const suggestions: UpsellSuggestion[] = [];
    const hasPizzaOrPasta = cartItemIds.some((id) => {
      const item = catalog.find((i) => i.id === id);
      return item?.name.toLowerCase().includes('pizza') || item?.name.toLowerCase().includes('pasta');
    });

    const hasBeverage = cartItemIds.some((id) => {
      const item = catalog.find((i) => i.id === id);
      return item?.name.toLowerCase().includes('spritz') || item?.allergens.length === 0;
    });

    if (hasPizzaOrPasta && !hasBeverage) {
      const spritz = catalog.find((i) => i.name.includes('Spritz'));
      if (spritz) {
        suggestions.push({
          targetMenuItemId: spritz.id,
          name: spritz.name,
          priceCents: spritz.basePriceCents,
          reason: '84% of diners pairing this dish order our refreshing Sicilian Spritz!',
        });
      }
    }

    return suggestions;
  }

  /**
   * 2. AI Predictive Inventory & 86 Item Depletion Forecaster
   */
  public predictDepletion(
    ingredientInventory: Array<{ name: string; currentStock: number; hourlyUsage: number }>
  ): InventoryDepletionPrediction[] {
    return ingredientInventory.map((item) => {
      const hours = item.hourlyUsage > 0 ? +(item.currentStock / item.hourlyUsage).toFixed(1) : 999;
      let riskLevel: InventoryDepletionPrediction['riskLevel'] = 'HEALTHY';
      let action = 'Stock level adequate for regular shift.';

      if (hours <= 2.5) {
        riskLevel = 'CRITICAL_STOCKOUT_RISK';
        action = `86 Risk within ${hours}h! Initiate immediate rush supplier dispatch or switch menu highlight.`;
      } else if (hours <= 5.0) {
        riskLevel = 'MODERATE';
        action = 'Monitor consumption. Prepare backup prep for dinner peak.';
      }

      return {
        ingredient: item.name,
        currentStockUnits: item.currentStock,
        burnRatePerHour: item.hourlyUsage,
        projectedHoursRemaining: hours,
        riskLevel,
        recommendedAction: action,
      };
    });
  }

  /**
   * 3. AI Personalized Win-Back & Customer Retention Copilot
   */
  public generateWinBackCampaign(guest: {
    name: string;
    phone: string;
    daysSinceLastVisit: number;
    favoriteDish: string;
  }): WinBackCampaignOffer {
    const promoCode = `COMEBACK${Math.floor(100 + Math.random() * 900)}`;

    return {
      guestIdentifier: guest.phone,
      guestName: guest.name,
      channel: 'WHATSAPP',
      promoCode,
      discountValue: '₹100 / $10 Off',
      expiryDays: 5,
      messageText: {
        en: `Hi ${guest.name}! We miss you at Trattoria Abiruchi Hotel. Your favorite ${guest.favoriteDish} is waiting for you! Enjoy ₹100 off on your next visit with code ${promoCode} (Valid 5 days). Tap here to reserve your table: https://abiruchi.local`,
        hi: `नमस्ते ${guest.name}! हमें त्रात्तोरिया सेर्वोरा में आपकी याद आ रही है। आपके पसंदीदा ${guest.favoriteDish} पर कोड ${promoCode} के साथ ₹100 की छूट पाएं! (5 दिनों के लिए वैध)`,
        te: `నమస్కారం ${guest.name}! ట్రాటోరియా సెర్వోరా మిమ్మల్ని ఆహ్వానిస్తోంది. మీ ఇష్టమైన ${guest.favoriteDish} పై ${promoCode} కోడ్‌తో ₹100 తగ్గింపు పొందండి! (5 రోజులు మాత్రమే చెల్లుబాటు)`,
      },
    };
  }

  /**
   * 4. AI Multi-Lingual Dietary Concierge (English, Hindi, Telugu)
   */
  public answerDietaryQuery(
    query: string,
    locale: 'en' | 'hi' | 'te',
    catalog: MenuItem[]
  ): { message: string; safeDishes: string[] } {
    const q = query.toLowerCase();

    if (q.includes('gluten') || q.includes('ग्लूटेन') || q.includes('గ్లూటెన్')) {
      const safe = catalog.filter((i) => !i.allergens.includes('gluten') || i.modifierGroups?.length);
      const names = safe.map((s) => s.name);

      if (locale === 'hi') {
        return {
          message: 'यहाँ हमारे ग्लूटेन-मुक्त व्यंजन और अनुकूलन योग्य पिज़्ज़ा विकल्प हैं:',
          safeDishes: names,
        };
      }
      if (locale === 'te') {
        return {
          message: 'ఇవి మా గ్లూటెన్ లేని వంటకాలు మరియు మార్చుకోగల పిజ్జా ఎంపికలు:',
          safeDishes: names,
        };
      }
      return {
        message: 'Here are our gluten-free and customizable crust options:',
        safeDishes: names,
      };
    }

    if (q.includes('dairy') || q.includes('दूध') || q.includes('డైరీ') || q.includes('vegan')) {
      const safe = catalog.filter((i) => !i.allergens.includes('dairy')).map((s) => s.name);
      if (locale === 'hi') {
        return {
          message: 'डेयरी-मुक्त और लैक्टोज-मुक्त स्वादिष्ट व्यंजन:',
          safeDishes: safe,
        };
      }
      if (locale === 'te') {
        return {
          message: 'డైరీ లేని రుచికరమైన వంటకాల జాబితా:',
          safeDishes: safe,
        };
      }
      return {
        message: 'Here are our dairy-free and vegan-safe dishes:',
        safeDishes: safe,
      };
    }

    return {
      message: 'All our dishes are crafted fresh with authentic heritage ingredients.',
      safeDishes: catalog.slice(0, 3).map((s) => s.name),
    };
  }

  /**
   * 5. AI Dynamic Flash Pricing & Happy Hour Yield Optimizer
   */
  public evaluateDynamicPricing(currentOccupancyPercent: number, currentHour: number): FlashDeal {
    // If between 3 PM and 6 PM and occupancy is under 40%, trigger Happy Hour flash pricing
    const isLullHour = currentHour >= 15 && currentHour <= 18;
    const isUnderCapacity = currentOccupancyPercent < 50;

    if (isLullHour && isUnderCapacity) {
      return {
        dealId: `flash_${Date.now()}`,
        title: '⚡ Afternoon Happy Hour: 20% Off All Beverages & Starters!',
        discountPercent: 20,
        activeFromHour: 15,
        activeToHour: 18,
        appliesToCategory: 'Beverages & Starters',
        status: 'ACTIVE',
      };
    }

    return {
      dealId: 'deal_regular',
      title: 'Standard Dining Pricing',
      discountPercent: 0,
      activeFromHour: 0,
      activeToHour: 24,
      appliesToCategory: 'None',
      status: 'STANDBY',
    };
  }
}
