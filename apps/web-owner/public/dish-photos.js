// Automated Dish Photo Matcher & Cuisine Visual Dictionary (Browser Client)
(function (global) {
  const AUTHENTIC_DISH_PHOTOS = {
  "Plain Idli": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80&dish=plain-idli",
  "Sambar Idli": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80&dish=sambar-idli",
  "Ghee Idli": "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=600&q=80&dish=ghee-idli",
  "Plain Dosa": "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80&dish=plain-dosa",
  "Masala Dosa": "https://images.unsplash.com/photo-1625398407796-82650a8c135f?auto=format&fit=crop&w=600&q=80&dish=masala-dosa",
  "Ghee Karam Dosa": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80&dish=ghee-karam-dosa",
  "Onion Dosa": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80&dish=onion-dosa",
  "Pesarattu": "https://images.unsplash.com/photo-1589301764619-3c35f793b827?auto=format&fit=crop&w=600&q=80&dish=pesarattu",
  "Upma": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80&dish=upma",
  "Poori": "https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=600&q=80&dish=poori",
  "Pongal": "https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80&dish=pongal",
  "Vada": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80&dish=medu-vada",
  "Rava Dosa": "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=600&q=80&dish=rava-dosa",
  "Mysore Masala Dosa": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80&dish=mysore-masala-dosa",
  "South Indian Meals": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80&dish=south-indian-meals",
  "Andhra Meals": "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80&dish=andhra-meals",
  "Veg Meals": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80&dish=veg-meals",
  "Curd Rice": "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80&dish=curd-rice",
  "Lemon Rice": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80&dish=lemon-rice",
  "Tomato Rice": "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=600&q=80&dish=tomato-rice",
  "Veg Biryani": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80&dish=veg-biryani",
  "Paneer Biryani": "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=600&q=80&dish=paneer-biryani",
  "Chicken Biryani": "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=600&q=80&dish=chicken-biryani",
  "Chicken Meals": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80&dish=chicken-meals",
  "Sambar Rice": "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80&dish=sambar-rice",
  "Special Thali": "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80&dish=special-thali",
  "Egg Biryani": "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80&dish=egg-biryani",
  "Chapati": "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=600&q=80&dish=chapati",
  "Parotta": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80&dish=malabar-parotta",
  "Paneer Curry": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80&dish=paneer-curry",
  "Kadai Paneer": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80&dish=kadai-paneer",
  "Dal Tadka": "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80&dish=dal-tadka",
  "Veg Fried Rice": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80&dish=veg-fried-rice",
  "Chicken Fried Rice": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80&dish=chicken-fried-rice",
  "Veg Noodles": "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80&dish=veg-noodles",
  "Chicken Noodles": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80&dish=chicken-noodles",
  "Tandoori Roti": "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=600&q=80&dish=tandoori-roti",
  "Butter Naan": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80&dish=butter-naan",
  "Samosa": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80&dish=samosa",
  "Punugulu": "https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=600&q=80&dish=punugulu",
  "Mirchi Bajji": "https://images.unsplash.com/photo-1589301764619-3c35f793b827?auto=format&fit=crop&w=600&q=80&dish=mirchi-bajji",
  "Onion Pakoda": "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80&dish=onion-pakoda",
  "Gobi 65": "https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=600&q=80&dish=gobi-65",
  "Paneer 65": "https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=600&q=80&dish=paneer-65",
  "French Fries": "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80&dish=french-fries",
  "Veg Spring Rolls": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80&dish=veg-spring-rolls",
  "Chicken 65": "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&w=600&q=80&dish=chicken-65",
  "Packaged Water Bottle (1L)": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80&dish=packaged-water",
  "Masala Buttermilk": "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80&dish=masala-buttermilk",
  "Fresh Lime Soda": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80&dish=fresh-lime-soda",
  "Fresh Lemon Juice": "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=600&q=80&dish=fresh-lemon-juice",
  "Alphonso Mango Juice": "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80&dish=alphonso-mango-juice",
  "Fresh Orange Juice": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80&dish=fresh-orange-juice",
  "Badam Milk (Chilled)": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80&dish=badam-milk",
  "Soft Drink Can (330ml)": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80&dish=soft-drink-can",
  "South Indian Filter Coffee": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80&dish=filter-coffee"
};

  function getAutoDishPhoto(dishName, categoryName) {
    if (!dishName) return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80';
    const trimmed = dishName.trim();
    if (AUTHENTIC_DISH_PHOTOS[trimmed]) return AUTHENTIC_DISH_PHOTOS[trimmed];
    const lower = trimmed.toLowerCase();
    for (const [k, url] of Object.entries(AUTHENTIC_DISH_PHOTOS)) {
      if (lower === k.toLowerCase() || lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)) {
        return url;
      }
    }
    return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80';
  }

  global.AUTHENTIC_DISH_PHOTOS = AUTHENTIC_DISH_PHOTOS;
  global.getAutoDishPhoto = getAutoDishPhoto;
})(typeof window !== 'undefined' ? window : globalThis);
