/**
 * Automated Dish Photo Matcher & Cuisine Visual Dictionary
 * Maps dish names and culinary keywords to authentic high-resolution food photography.
 */

export interface DishPhotoPreset {
  keywords: string[];
  url: string;
  label: string;
  category: string;
}

export const DISH_PHOTO_PRESETS: DishPhotoPreset[] = [
  // Specific Idli Variations
  { keywords: ['sambar idli', 'dip idli'], url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80', label: 'Sambar Dipped Idli', category: 'Tiffins' },
  { keywords: ['ghee idli', 'podi idli', 'button idli'], url: 'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=600&q=80', label: 'Ghee Podi Mini Idli', category: 'Tiffins' },
  { keywords: ['plain idli', 'steamed idli', 'idli'], url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80', label: 'Fluffy Steamed Idli', category: 'Tiffins' },

  // Specific Dosa Variations
  { keywords: ['mysore masala', 'mysore dosa'], url: 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?auto=format&fit=crop&w=600&q=80', label: 'Mysore Butter Masala Dosa', category: 'Tiffins' },
  { keywords: ['rava dosa', 'onion rava'], url: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=600&q=80', label: 'Lacey Crispy Rava Dosa', category: 'Tiffins' },
  { keywords: ['ghee karam dosa', 'karam dosa', 'ghee roast'], url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80', label: 'Ghee Karam Red Dosa', category: 'Tiffins' },
  { keywords: ['onion dosa', 'uthappam', 'onion uthappam'], url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80', label: 'Caramelized Onion Dosa', category: 'Tiffins' },
  { keywords: ['pesarattu', 'moong dosa'], url: 'https://images.unsplash.com/photo-1589301764619-3c35f793b827?auto=format&fit=crop&w=600&q=80', label: 'Andhra Green Pesarattu', category: 'Tiffins' },
  { keywords: ['masala dosa', 'benne dosa'], url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80', label: 'Golden Masala Dosa', category: 'Tiffins' },
  { keywords: ['plain dosa', 'sada dosa', 'roast dosa', 'dosa'], url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80', label: 'Crispy Plain Roast Dosa', category: 'Tiffins' },

  // Breakfast items
  { keywords: ['vada', 'medu vada', 'sambar vada'], url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80', label: 'Crispy Medu Vada', category: 'Tiffins' },
  { keywords: ['poori', 'puri', 'poori bhaji'], url: 'https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=600&q=80', label: 'Puffed Golden Pooris', category: 'Tiffins' },
  { keywords: ['pongal', 'khara pongal', 'ven pongal'], url: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80', label: 'Ghee Cashew Ven Pongal', category: 'Tiffins' },
  { keywords: ['upma', 'rava upma', 'khara bath'], url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80', label: 'Steaming Hot Rava Upma', category: 'Tiffins' },

  // Specific Meals & Thalis
  { keywords: ['andhra meals', 'andhra thali'], url: 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80', label: 'Spicy Andhra Thali', category: 'Lunch' },
  { keywords: ['special thali', 'royal thali'], url: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80', label: 'Royal Special Thali', category: 'Lunch' },
  { keywords: ['chicken meals', 'non veg meals'], url: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80', label: 'Special Chicken Curry Meals', category: 'Lunch' },
  { keywords: ['veg meals'], url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80', label: 'Deluxe Veg Thali Meals', category: 'Lunch' },
  { keywords: ['south indian meals', 'banana leaf', 'meals'], url: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80', label: 'Traditional Banana Leaf Meals', category: 'Lunch' },

  // Specific Rice Preparations
  { keywords: ['curd rice', 'thayir sadam', 'daddojanam'], url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80', label: 'Creamy Tempered Curd Rice', category: 'Lunch' },
  { keywords: ['lemon rice', 'chitranna'], url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80', label: 'Zesty Peanut Lemon Rice', category: 'Lunch' },
  { keywords: ['tomato rice', 'tomato bath'], url: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=600&q=80', label: 'Spiced Tomato Rice Bath', category: 'Lunch' },
  { keywords: ['sambar rice', 'bisibelebath'], url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80', label: 'Hot Sambar Rice with Ghee', category: 'Lunch' },

  // Specific Biryanis
  { keywords: ['paneer biryani'], url: 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=600&q=80', label: 'Tandoori Paneer Dum Biryani', category: 'Lunch' },
  { keywords: ['egg biryani'], url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80', label: 'Roast Egg Dum Biryani', category: 'Lunch' },
  { keywords: ['chicken biryani', 'dum biryani'], url: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=600&q=80', label: 'Hyderabadi Chicken Dum Biryani', category: 'Lunch' },
  { keywords: ['veg biryani', 'vegetable biryani', 'biryani'], url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', label: 'Fragrant Vegetable Dum Biryani', category: 'Lunch' },

  // Specific Breads & Curries
  { keywords: ['parotta', 'paratha', 'kerala parotta'], url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80', label: 'Flaky Layered Malabar Parotta', category: 'Dinner' },
  { keywords: ['chapati', 'roti', 'phulka'], url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80', label: 'Soft Whole Wheat Chapati', category: 'Dinner' },
  { keywords: ['butter naan', 'naan', 'garlic naan'], url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80', label: 'Pillowy Butter Naan', category: 'Dinner' },
  { keywords: ['tandoori roti'], url: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80', label: 'Crisp Tandoori Roti', category: 'Dinner' },
  { keywords: ['kadai paneer'], url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80', label: 'Spiced Kadai Paneer', category: 'Dinner' },
  { keywords: ['paneer curry', 'paneer butter masala', 'paneer'], url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80', label: 'Velvety Paneer Butter Masala', category: 'Dinner' },
  { keywords: ['dal tadka', 'dal fry', 'dal'], url: 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80', label: 'Golden Garlic Dal Tadka', category: 'Dinner' },

  // Chinese & Fast Food
  { keywords: ['chicken fried rice'], url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80', label: 'Chicken Egg Fried Rice', category: 'Dinner' },
  { keywords: ['veg fried rice', 'fried rice'], url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80', label: 'Wok-Tossed Veg Fried Rice', category: 'Dinner' },
  { keywords: ['chicken noodles'], url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80', label: 'Chicken Stir-Fry Noodles', category: 'Dinner' },
  { keywords: ['veg noodles', 'noodles', 'hakka noodles'], url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80', label: 'Stir-Fried Veg Hakka Noodles', category: 'Dinner' },

  // Specific Starters & Snacks
  { keywords: ['samosa'], url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80', label: 'Crispy Potato Samosa', category: 'Snacks' },
  { keywords: ['punugulu', 'bonda'], url: 'https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=600&q=80', label: 'Crunchy Andhra Punugulu', category: 'Snacks' },
  { keywords: ['mirchi bajji', 'bajji'], url: 'https://images.unsplash.com/photo-1589301764619-3c35f793b827?auto=format&fit=crop&w=600&q=80', label: 'Crispy Stuffed Mirchi Bajji', category: 'Snacks' },
  { keywords: ['onion pakoda', 'pakoda', 'pakora'], url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80', label: 'Crispy Onion Pakoda', category: 'Snacks' },
  { keywords: ['gobi 65', 'gobi manchurian', 'gobi'], url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80', label: 'Spicy Gobi 65', category: 'Snacks' },
  { keywords: ['paneer 65', 'paneer tikka'], url: 'https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=600&q=80', label: 'Crispy Fried Paneer 65', category: 'Snacks' },
  { keywords: ['chicken 65'], url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80', label: 'Fiery Andhra Chicken 65', category: 'Snacks' },
  { keywords: ['french fries', 'fries'], url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80', label: 'Crispy Salted French Fries', category: 'Snacks' },
  { keywords: ['spring rolls'], url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', label: 'Golden Veg Spring Rolls', category: 'Snacks' },
  { keywords: ['mysore pak', 'sweet', 'dessert', 'gulab jamun', 'halwa', 'laddu'], url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80', label: 'Traditional Ghee Sweet', category: 'Snacks' },

  // Cool Drinks & Beverages
  { keywords: ['water bottle', 'packaged water', 'mineral water'], url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80', label: 'Chilled Packaged Water Bottle', category: 'Cool Drinks' },
  { keywords: ['filter coffee', 'coffee'], url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80', label: 'South Indian Degree Filter Coffee', category: 'Cool Drinks' },
  { keywords: ['tea', 'chai', 'masala chai'], url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', label: 'Hot Aromatic Masala Chai', category: 'Cool Drinks' },
  { keywords: ['masala buttermilk', 'buttermilk', 'chaas', 'majjiga'], url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80', label: 'Spiced Refreshing Buttermilk', category: 'Cool Drinks' },
  { keywords: ['lime soda', 'fresh lime', 'soda'], url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', label: 'Sparkling Fresh Lime Soda', category: 'Cool Drinks' },
  { keywords: ['lemon juice', 'nimbu pani'], url: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=600&q=80', label: 'Chilled Fresh Lemon Juice', category: 'Cool Drinks' },
  { keywords: ['mango juice', 'mango lassi', 'mango'], url: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80', label: 'Alphonso Mango Nectar Juice', category: 'Cool Drinks' },
  { keywords: ['orange juice', 'orange'], url: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80', label: 'Fresh Squeezed Citrus Orange Juice', category: 'Cool Drinks' },
  { keywords: ['badam milk', 'almond milk'], url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80', label: 'Saffron Badam Milk with Nuts', category: 'Cool Drinks' },
  { keywords: ['soft drink', 'cola', 'pepsi', 'sprite', 'coke'], url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', label: 'Chilled Carbonated Soda Can', category: 'Cool Drinks' },
];

export const AUTHENTIC_DISH_PHOTOS: Record<string, string> = {
  'Plain Idli': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80&dish=plain-idli',
  'Sambar Idli': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80&dish=sambar-idli',
  'Ghee Idli': 'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=600&q=80&dish=ghee-idli',
  'Plain Dosa': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80&dish=plain-dosa',
  'Masala Dosa': 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?auto=format&fit=crop&w=600&q=80&dish=masala-dosa',
  'Ghee Karam Dosa': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80&dish=ghee-karam-dosa',
  'Onion Dosa': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80&dish=onion-dosa',
  'Pesarattu': 'https://images.unsplash.com/photo-1589301764619-3c35f793b827?auto=format&fit=crop&w=600&q=80&dish=pesarattu',
  'Upma': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80&dish=upma',
  'Poori': 'https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=600&q=80&dish=poori',
  'Pongal': 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80&dish=pongal',
  'Vada': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80&dish=medu-vada',
  'Rava Dosa': 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=600&q=80&dish=rava-dosa',
  'Mysore Masala Dosa': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80&dish=mysore-masala-dosa',
  'South Indian Meals': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80&dish=south-indian-meals',
  'Andhra Meals': 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80&dish=andhra-meals',
  'Veg Meals': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80&dish=veg-meals',
  'Curd Rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80&dish=curd-rice',
  'Lemon Rice': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80&dish=lemon-rice',
  'Tomato Rice': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=600&q=80&dish=tomato-rice',
  'Veg Biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80&dish=veg-biryani',
  'Paneer Biryani': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=600&q=80&dish=paneer-biryani',
  'Chicken Biryani': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=600&q=80&dish=chicken-biryani',
  'Chicken Meals': 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80&dish=chicken-meals',
  'Sambar Rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80&dish=sambar-rice',
  'Special Thali': 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80&dish=special-thali',
  'Egg Biryani': 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80&dish=egg-biryani',
  'Chapati': 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=600&q=80&dish=chapati',
  'Parotta': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80&dish=malabar-parotta',
  'Paneer Curry': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80&dish=paneer-curry',
  'Kadai Paneer': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80&dish=kadai-paneer',
  'Dal Tadka': 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80&dish=dal-tadka',
  'Veg Fried Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80&dish=veg-fried-rice',
  'Chicken Fried Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80&dish=chicken-fried-rice',
  'Veg Noodles': 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80&dish=veg-noodles',
  'Chicken Noodles': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80&dish=chicken-noodles',
  'Tandoori Roti': 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=600&q=80&dish=tandoori-roti',
  'Butter Naan': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80&dish=butter-naan',
  'Samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80&dish=samosa',
  'Punugulu': 'https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=600&q=80&dish=punugulu',
  'Mirchi Bajji': 'https://images.unsplash.com/photo-1589301764619-3c35f793b827?auto=format&fit=crop&w=600&q=80&dish=mirchi-bajji',
  'Onion Pakoda': 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80&dish=onion-pakoda',
  'Gobi 65': 'https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=600&q=80&dish=gobi-65',
  'Paneer 65': 'https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=600&q=80&dish=paneer-65',
  'French Fries': 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80&dish=french-fries',
  'Veg Spring Rolls': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80&dish=veg-spring-rolls',
  'Chicken 65': 'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&w=600&q=80&dish=chicken-65',
  'Packaged Water Bottle (1L)': 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80&dish=packaged-water',
  'Masala Buttermilk': 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80&dish=masala-buttermilk',
  'Fresh Lime Soda': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80&dish=fresh-lime-soda',
  'Fresh Lemon Juice': 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=600&q=80&dish=fresh-lemon-juice',
  'Alphonso Mango Juice': 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80&dish=alphonso-mango-juice',
  'Fresh Orange Juice': 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80&dish=fresh-orange-juice',
  'Badam Milk (Chilled)': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80&dish=badam-milk',
  'Soft Drink Can (330ml)': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80&dish=soft-drink-can',
  'South Indian Filter Coffee': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80&dish=filter-coffee'
};

/**
 * Automatically find the most fitting high-resolution photo for a dish name
 */
export function getAutoDishPhoto(dishName: string, categoryName: string = ''): string {
  const trimmed = (dishName || '').trim();
  if (AUTHENTIC_DISH_PHOTOS[trimmed]) {
    return AUTHENTIC_DISH_PHOTOS[trimmed];
  }

  const normalized = trimmed.toLowerCase();
  for (const [k, url] of Object.entries(AUTHENTIC_DISH_PHOTOS)) {
    if (normalized === k.toLowerCase() || normalized.includes(k.toLowerCase()) || k.toLowerCase().includes(normalized)) {
      return url;
    }
  }

  const normalizedCat = (categoryName || '').toLowerCase().trim();

  // 1. Direct keyword search
  for (const preset of DISH_PHOTO_PRESETS) {
    for (const kw of preset.keywords) {
      if (normalized.includes(kw)) {
        return preset.url;
      }
    }
  }

  // 2. Category fallback
  if (normalizedCat.includes('tiffin') || normalizedCat.includes('breakfast')) {
    return 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80';
  }
  if (normalizedCat.includes('lunch') || normalizedCat.includes('meal')) {
    return 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80';
  }
  if (normalizedCat.includes('dinner') || normalizedCat.includes('curry')) {
    return 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80';
  }
  if (normalizedCat.includes('snack') || normalizedCat.includes('starter')) {
    return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80';
  }
  if (normalizedCat.includes('drink') || normalizedCat.includes('beverage')) {
    return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80';
  }

  return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80';
}
