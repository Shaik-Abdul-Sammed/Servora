// Automated Dish Photo Matcher & Cuisine Visual Dictionary (Browser Client)
(function (global) {
  const DISH_PHOTO_PRESETS = [
    { keywords: ["tiffins"], url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80", label: "Tiffins" },
    { keywords: ["sambar idli"], url: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80", label: "Sambar Idli" },
    { keywords: ["ghee idli"], url: "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=600&q=80", label: "Ghee Idli" },
    { keywords: ["plain dosa","plain"], url: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80", label: "Plain Dosa" },
    { keywords: ["masala dosa","masala"], url: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", label: "Masala Dosa" },
    { keywords: ["ghee karam dosa","ghee karam"], url: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80", label: "Ghee Karam Dosa" },
    { keywords: ["onion dosa","onion"], url: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80", label: "Onion Dosa" },
    { keywords: ["pesarattu"], url: "https://images.unsplash.com/photo-1589301764619-3c35f793b827?auto=format&fit=crop&w=600&q=80", label: "Pesarattu" },
    { keywords: ["upma"], url: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80", label: "Upma" },
    { keywords: ["poori"], url: "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80", label: "Poori" },
    { keywords: ["pongal"], url: "https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80", label: "Pongal" },
    { keywords: ["vada"], url: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", label: "Vada" },
    { keywords: ["rava dosa","rava"], url: "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=600&q=80", label: "Rava Dosa" },
    { keywords: ["mysore masala dosa","mysore masala"], url: "https://images.unsplash.com/photo-1625398407796-82650a8c135f?auto=format&fit=crop&w=600&q=80", label: "Mysore Masala Dosa" },
    { keywords: ["south indian meals"], url: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80", label: "South Indian Meals" },
    { keywords: ["andhra meals"], url: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80", label: "Andhra Meals" },
    { keywords: ["veg meals"], url: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80", label: "Veg Meals" },
    { keywords: ["curd rice","curd"], url: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80", label: "Curd Rice" },
    { keywords: ["lemon rice","lemon"], url: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80", label: "Lemon Rice" },
    { keywords: ["tomato rice","tomato"], url: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=600&q=80", label: "Tomato Rice" },
    { keywords: ["veg biryani"], url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80", label: "Veg Biryani" },
    { keywords: ["paneer biryani"], url: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=600&q=80", label: "Paneer Biryani" },
    { keywords: ["chicken biryani"], url: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=600&q=80", label: "Chicken Biryani" },
    { keywords: ["chicken meals"], url: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80", label: "Chicken Meals" },
    { keywords: ["sambar rice","sambar"], url: "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=600&q=80", label: "Sambar Rice" },
    { keywords: ["special thali"], url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80", label: "Special Thali" },
    { keywords: ["egg biryani"], url: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80", label: "Egg Biryani" },
    { keywords: ["chapati"], url: "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=600&q=80", label: "Chapati" },
    { keywords: ["parotta"], url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80", label: "Parotta" },
    { keywords: ["paneer curry"], url: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80", label: "Paneer Curry" },
    { keywords: ["kadai paneer"], url: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80", label: "Kadai Paneer" },
    { keywords: ["dal tadka"], url: "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80", label: "Dal Tadka" },
    { keywords: ["veg fried rice","veg fried"], url: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80", label: "Veg Fried Rice" },
    { keywords: ["chicken fried rice","chicken fried"], url: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=600&q=80", label: "Chicken Fried Rice" },
    { keywords: ["veg noodles"], url: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", label: "Veg Noodles" },
    { keywords: ["chicken noodles"], url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80", label: "Chicken Noodles" },
    { keywords: ["tandoori roti"], url: "https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&w=600&q=80", label: "Tandoori Roti" },
    { keywords: ["butter naan"], url: "https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=600&q=80", label: "Butter Naan" },
    { keywords: ["samosa"], url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80", label: "Samosa" },
    { keywords: ["punugulu"], url: "https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=600&q=80", label: "Punugulu" },
    { keywords: ["mirchi bajji"], url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80", label: "Mirchi Bajji" },
    { keywords: ["onion pakoda"], url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80", label: "Onion Pakoda" },
    { keywords: ["gobi 65"], url: "https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=600&q=80", label: "Gobi 65" },
    { keywords: ["paneer 65"], url: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80", label: "Paneer 65" },
    { keywords: ["french fries"], url: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80", label: "French Fries" },
    { keywords: ["veg spring rolls"], url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80", label: "Veg Spring Rolls" },
    { keywords: ["chicken 65"], url: "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&w=600&q=80", label: "Chicken 65" },
    { keywords: ["packaged water bottle (1l)"], url: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80", label: "Packaged Water Bottle (1L)" },
    { keywords: ["masala buttermilk"], url: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80", label: "Masala Buttermilk" },
    { keywords: ["fresh lime soda"], url: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80", label: "Fresh Lime Soda" },
    { keywords: ["fresh lemon juice"], url: "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=600&q=80", label: "Fresh Lemon Juice" },
    { keywords: ["alphonso mango juice"], url: "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80", label: "Alphonso Mango Juice" },
    { keywords: ["fresh orange juice"], url: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80", label: "Fresh Orange Juice" },
    { keywords: ["badam milk (chilled)"], url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80", label: "Badam Milk (Chilled)" },
    { keywords: ["soft drink can (330ml)"], url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", label: "Soft Drink Can (330ml)" },
    { keywords: ["south indian filter coffee"], url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80", label: "South Indian Filter Coffee" }
  ];

  function getAutoDishPhoto(dishName, categoryName) {
    const normalized = (dishName || "").toLowerCase().trim();
    for (const preset of DISH_PHOTO_PRESETS) {
      for (const kw of preset.keywords) {
        if (kw && normalized.includes(kw)) {
          return preset.url;
        }
      }
    }
    return "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80";
  }

  global.DISH_PHOTO_PRESETS = DISH_PHOTO_PRESETS;
  global.getAutoDishPhoto = getAutoDishPhoto;
})(typeof window !== "undefined" ? window : globalThis);
