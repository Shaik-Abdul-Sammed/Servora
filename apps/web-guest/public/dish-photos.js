// Automated Dish Photo Matcher & Cuisine Visual Dictionary (Browser Client)
(function (global) {
  const MULTILINGUAL_DISH_ALIASES = {
    // Telugu (తెలుగు) aliases
    'ప్లెయిన్ ఇడ్లీ': 'Plain Idli',
    'సాంబార్ ఇడ్లీ': 'Sambar Idli',
    'సాంబార్ ఇడ్లి': 'Sambar Idli',
    'నెయ్యి ఇడ్లీ': 'Ghee Idli',
    'నెయ్యి కారం దోశ': 'Ghee Karam Dosa',
    'కారం దోశ': 'Ghee Karam Dosa',
    'ప్లెయిన్ దోశ': 'Plain Dosa',
    'మసాలా దోశ': 'Masala Dosa',
    'ఉల్లి దోశ': 'Onion Dosa',
    'రవ్వ దోశ': 'Rava Dosa',
    'పెసరట్టు': 'Pesarattu',
    'ఉప్మా': 'Upma',
    'పూరి': 'Poori',
    'పొంగల్': 'Pongal',
    'వడ': 'Vada',
    'మేదు వడ': 'Vada',
    'మైసూర్ మసాలా దోశ': 'Mysore Masala Dosa',
    'ఆంధ్ర భోజనం': 'Andhra Meals',
    'ఆంధ్ర మీల్స్': 'Andhra Meals',
    'దక్షిణ భారత భోజనం': 'South Indian Meals',
    'వెజ్ భోజనం': 'Veg Meals',
    'పెరుగు అన్నం': 'Curd Rice',
    'దద్దోజనం': 'Curd Rice',
    'నిమ్మకాయ అన్నం': 'Lemon Rice',
    'చిత్రాన్నం': 'Lemon Rice',
    'టమాటా అన్నం': 'Tomato Rice',
    'టమాటా బాత్': 'Tomato Rice',
    'వెజ్ బిర్యానీ': 'Veg Biryani',
    'పనీర్ బిర్యానీ': 'Paneer Biryani',
    'చికెన్ బిర్యానీ': 'Chicken Biryani',
    'చికెన్ దమ్ బిర్యానీ': 'Chicken Biryani',
    'దమ్ బిర్యానీ': 'Chicken Biryani',
    'చికెన్ మీల్స్': 'Chicken Meals',
    'సాంబార్ అన్నం': 'Sambar Rice',
    'బిసిబేలేబాత్': 'Sambar Rice',
    'స్పెషల్ థాలి': 'Special Thali',
    'ఎగ్ బిర్యానీ': 'Egg Biryani',
    'కోడిగుడ్డు బిర్యానీ': 'Egg Biryani',
    'చపాతీ': 'Chapati',
    'పుల్కా': 'Chapati',
    'పరోటా': 'Parotta',
    'మలబార్ పరోటా': 'Parotta',
    'పనీర్ కర్రీ': 'Paneer Curry',
    'పనీర్ బటర్ మసాలా': 'Paneer Curry',
    'కడాయి పనీర్': 'Kadai Paneer',
    'దాల్ తడ్కా': 'Dal Tadka',
    'పప్పు తాలింపు': 'Dal Tadka',
    'వెజ్ ఫ్రైడ్ రైస్': 'Veg Fried Rice',
    'చికెన్ ఫ్రైడ్ రైస్': 'Chicken Fried Rice',
    'ఫ్రైడ్ రైస్': 'Veg Fried Rice',
    'వెజ్ నూడుల్స్': 'Veg Noodles',
    'చికెన్ నూడుల్స్': 'Chicken Noodles',
    'నూడుల్స్': 'Veg Noodles',
    'తందూరి రోటీ': 'Tandoori Roti',
    'బటర్ నాన్': 'Butter Naan',
    'నాన్': 'Butter Naan',
    'సమోసా': 'Samosa',
    'పునుగులు': 'Punugulu',
    'బోండా': 'Punugulu',
    'మిర్చి బజ్జీ': 'Mirchi Bajji',
    'బజ్జీ': 'Mirchi Bajji',
    'ఉల్లి పకోడా': 'Onion Pakoda',
    'పకోడి': 'Onion Pakoda',
    'గోబీ 65': 'Gobi 65',
    'పనీర్ 65': 'Paneer 65',
    'ఫ్రెంచ్ ఫ్రైస్': 'French Fries',
    'వెజ్ స్ప్రింగ్ రోల్స్': 'Veg Spring Rolls',
    'చికెన్ 65': 'Chicken 65',
    'వాటర్ బాటిల్': 'Packaged Water Bottle (1L)',
    'మినరల్ వాటర్': 'Packaged Water Bottle (1L)',
    'మసాలా మజ్జిగ': 'Masala Buttermilk',
    'మజ్జిగ': 'Masala Buttermilk',
    'ఫ్రెష్ లైమ్ సోడా': 'Fresh Lime Soda',
    'నిమ్మరసం': 'Fresh Lemon Juice',
    'మామిడి రసం': 'Alphonso Mango Juice',
    'ఆరెంజ్ జ్యూస్': 'Fresh Orange Juice',
    'బాదం పాలు': 'Badam Milk (Chilled)',
    'కూల్ డ్రింక్': 'Soft Drink Can (330ml)',
    'ఫిల్టర్ కాఫీ': 'South Indian Filter Coffee',
    'కాఫీ': 'South Indian Filter Coffee',
    'టీ': 'Masala Chai',
    'చాయ్': 'Masala Chai',

    // Hindi (हिंदी) aliases
    'प्लेन इडली': 'Plain Idli',
    'इडली': 'Plain Idli',
    'सांभर इडली': 'Sambar Idli',
    'घी इडली': 'Ghee Idli',
    'प्लेन डोसा': 'Plain Dosa',
    'मसाला डोसा': 'Masala Dosa',
    'डोसा': 'Plain Dosa',
    'प्याज डोसा': 'Onion Dosa',
    'रवा डोसा': 'Rava Dosa',
    'पेसरट्टू': 'Pesarattu',
    'उपमा': 'Upma',
    'पूरी': 'Poori',
    'पूरी भाजी': 'Poori',
    'पोंगल': 'Pongal',
    'वड़ा': 'Vada',
    'मेदू वड़ा': 'Vada',
    'सांभर वड़ा': 'Vada',
    'मैसूर मसाला डोसा': 'Mysore Masala Dosa',
    'आंध्र थाली': 'Andhra Meals',
    'साउथ इंडियन मील': 'South Indian Meals',
    'वेज मील': 'Veg Meals',
    'दही चावल': 'Curd Rice',
    'नींबू चावल': 'Lemon Rice',
    'टमाटर चावल': 'Tomato Rice',
    'वेज बिरयानी': 'Veg Biryani',
    'पनीर बिरयानी': 'Paneer Biryani',
    'चिकन बिरयानी': 'Chicken Biryani',
    'चिकन दम बिरयानी': 'Chicken Biryani',
    'बिरयानी': 'Chicken Biryani',
    'चिकन भोजन': 'Chicken Meals',
    'सांभर चावल': 'Sambar Rice',
    'स्पेशल थाली': 'Special Thali',
    'अंडा बिरयानी': 'Egg Biryani',
    'चपाती': 'Chapati',
    'रोटी': 'Chapati',
    'परोठा': 'Parotta',
    'मलबार परोठा': 'Parotta',
    'पनीर करी': 'Paneer Curry',
    'पनीर बटर मसाला': 'Paneer Curry',
    'कड़ाही पनीर': 'Kadai Paneer',
    'दाल तड़का': 'Dal Tadka',
    'दाल फ्राई': 'Dal Tadka',
    'वेज फ्राइड राइस': 'Veg Fried Rice',
    'चिकन फ्राइड राइस': 'Chicken Fried Rice',
    'वेज नूडल्स': 'Veg Noodles',
    'चिकन नूडल्स': 'Chicken Noodles',
    'नूडल्स': 'Veg Noodles',
    'तंदूरी रोटी': 'Tandoori Roti',
    'बटर नान': 'Butter Naan',
    'नान': 'Butter Naan',
    'समोसा': 'Samosa',
    'पुनुगुलु': 'Punugulu',
    'मिर्ची भज्जी': 'Mirchi Bajji',
    'प्याज पकोड़ा': 'Onion Pakoda',
    'गोभी 65': 'Gobi 65',
    'पनीर 65': 'Paneer 65',
    'फ्रेंच फ्राइज': 'French Fries',
    'वेज स्प्रिंग रोल': 'Veg Spring Rolls',
    'चिकन 65': 'Chicken 65',
    'पानी की बोतल': 'Packaged Water Bottle (1L)',
    'मसाला छाछ': 'Masala Buttermilk',
    'छाछ': 'Masala Buttermilk',
    'ताजा नींबू सोडा': 'Fresh Lime Soda',
    'नींबू पानी': 'Fresh Lemon Juice',
    'आम का रस': 'Alphonso Mango Juice',
    'संतरे का रस': 'Fresh Orange Juice',
    'बादाम का दूध': 'Badam Milk (Chilled)',
    'सॉफ्ट ड्रिंक': 'Soft Drink Can (330ml)',
    'फ़िल्टर कॉफ़ी': 'South Indian Filter Coffee',
    'कॉफ़ी': 'South Indian Filter Coffee',
    'चाय': 'Masala Chai',
    'मसाला चाय': 'Masala Chai',
  };

  const AUTHENTIC_DISH_PHOTOS = {
    // Tiffins
    "Plain Idli": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80&dish=plain-idli",
    "Sambar Idli": "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=600&q=80&dish=sambar-idli",
    "Ghee Idli": "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=600&q=80&dish=ghee-idli",
    "Plain Dosa": "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80&dish=plain-dosa",
    "Masala Dosa": "https://images.unsplash.com/photo-1625398407796-82650a8c135f?auto=format&fit=crop&w=600&q=80&dish=masala-dosa",
    "Ghee Karam Dosa": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80&dish=ghee-karam-dosa",
    "Onion Dosa": "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=600&q=80&dish=onion-dosa",
    "Pesarattu": "https://upload.wikimedia.org/wikipedia/commons/6/6c/Pesarattu.jpg",
    "Upma": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80&dish=upma",
    "Poori": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80&dish=poori",
    "Pongal": "https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80&dish=pongal",
    "Vada": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80&dish=medu-vada",
    "Medu Vada": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80&dish=medu-vada",
    "Rava Dosa": "https://upload.wikimedia.org/wikipedia/commons/5/58/Rava_Dosa_with_Coriander_Chutney.jpg",
    "Mysore Masala Dosa": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Mysore_Masala_Dosa.jpg",

    // Lunch
    "South Indian Meals": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80&dish=south-indian-meals",
    "Andhra Meals": "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80&dish=andhra-meals",
    "Veg Meals": "https://upload.wikimedia.org/wikipedia/commons/8/85/South-Indian_thali.jpg",
    "Curd Rice": "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80&dish=curd-rice",
    "Lemon Rice": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80&dish=lemon-rice",
    "Tomato Rice": "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=600&q=80&dish=tomato-rice",
    "Veg Biryani": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80&dish=veg-biryani",
    "Paneer Biryani": "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=600&q=80&dish=paneer-biryani",
    "Chicken Biryani": "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=600&q=80&dish=chicken-biryani",
    "Chicken Meals": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80&dish=chicken-meals",
    "Sambar Rice": "https://upload.wikimedia.org/wikipedia/commons/0/04/Bisi_Bele_Bath_%28Bisibelebath%29.JPG",
    "Special Thali": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80&dish=special-thali",
    "Egg Biryani": "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80&dish=egg-biryani",

    // Dinner
    "Chapati": "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=600&q=80&dish=chapati",
    "Parotta": "https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=600&q=80&dish=malabar-parotta",
    "Paneer Curry": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80&dish=paneer-curry",
    "Kadai Paneer": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80&dish=kadai-paneer",
    "Dal Tadka": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Dal_Tadka-Delhi.jpg",
    "Veg Fried Rice": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80&dish=veg-fried-rice",
    "Chicken Fried Rice": "https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=600&q=80&dish=chicken-fried-rice",
    "Veg Noodles": "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80&dish=veg-noodles",
    "Chicken Noodles": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80&dish=chicken-noodles",
    "Tandoori Roti": "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80&dish=tandoori-roti",
    "Butter Naan": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80&dish=butter-naan",

    // Snacks
    "Samosa": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80&dish=samosa",
    "Punugulu": "https://upload.wikimedia.org/wikipedia/commons/3/3d/Punugulu_1.jpg",
    "Mirchi Bajji": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Andhra_famous_mirchi_bajji.JPG",
    "Onion Pakoda": "https://upload.wikimedia.org/wikipedia/commons/c/cf/Onion_pakora_-_a.jpg",
    "Gobi 65": "https://upload.wikimedia.org/wikipedia/commons/a/af/Gobi_65_%28cauliflower_fry%29.jpg",
    "Paneer 65": "https://upload.wikimedia.org/wikipedia/commons/f/f2/Paneer_tikka.jpg",
    "French Fries": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80&dish=french-fries",
    "Veg Spring Rolls": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80&dish=veg-spring-rolls",
    "Chicken 65": "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&w=600&q=80&dish=chicken-65",

    // Beverages
    "Packaged Water Bottle (1L)": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80&dish=packaged-water",
    "Masala Buttermilk": "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80&dish=masala-buttermilk",
    "Fresh Lime Soda": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80&dish=fresh-lime-soda",
    "Fresh Lemon Juice": "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=600&q=80&dish=fresh-lemon-juice",
    "Alphonso Mango Juice": "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80&dish=alphonso-mango-juice",
    "Fresh Orange Juice": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80&dish=fresh-orange-juice",
    "Badam Milk (Chilled)": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80&dish=badam-milk",
    "Soft Drink Can (330ml)": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80&dish=soft-drink-can",
    "South Indian Filter Coffee": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80&dish=filter-coffee",
    "Masala Chai": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80&dish=masala-chai",
    "Tea": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80&dish=masala-chai"
  };

  const KEYWORD_PRESETS = [
    { kw: 'sambar idli', url: 'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=600&q=80' },
    { kw: 'ghee idli', url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=600&q=80' },
    { kw: 'mysore masala', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Mysore_Masala_Dosa.jpg' },
    { kw: 'rava dosa', url: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Rava_Dosa_with_Coriander_Chutney.jpg' },
    { kw: 'ghee karam', url: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80' },
    { kw: 'onion dosa', url: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=600&q=80' },
    { kw: 'pesarattu', url: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Pesarattu.jpg' },
    { kw: 'masala dosa', url: 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?auto=format&fit=crop&w=600&q=80' },
    { kw: 'plain dosa', url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80' },
    { kw: 'plain idli', url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80' },
    { kw: 'medu vada', url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80' },
    { kw: 'vada', url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80' },
    { kw: 'poori', url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80' },
    { kw: 'pongal', url: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80' },
    { kw: 'malabar parotta', url: 'https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=600&q=80' },
    { kw: 'parotta', url: 'https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=600&q=80' },
    { kw: 'butter naan', url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80' },
    { kw: 'chicken 65', url: 'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&w=600&q=80' },
    { kw: 'chicken noodles', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80' },
    { kw: 'veg noodles', url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80' },
    { kw: 'chicken fried rice', url: 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=600&q=80' },
    { kw: 'veg fried rice', url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80' },
    { kw: 'chicken biryani', url: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=600&q=80' },
    { kw: 'veg biryani', url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80' },
    { kw: 'filter coffee', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80' },
    { kw: 'masala chai', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80' },
    { kw: 'tea', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80' },
    { kw: 'chai', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80' },
    { kw: 'samosa', url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80' },
    { kw: 'punugulu', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Punugulu_1.jpg' },
    { kw: 'mirchi bajji', url: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Andhra_famous_mirchi_bajji.JPG' },
    { kw: 'onion pakoda', url: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Onion_pakora_-_a.jpg' },
    { kw: 'gobi 65', url: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Gobi_65_%28cauliflower_fry%29.jpg' },
    { kw: 'paneer 65', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Paneer_tikka.jpg' },
    { kw: 'french fries', url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80' },
    { kw: 'dal tadka', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Dal_Tadka-Delhi.jpg' },
    { kw: 'andhra meals', url: 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80' },
    { kw: 'special thali', url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80' },
    { kw: 'veg meals', url: 'https://upload.wikimedia.org/wikipedia/commons/8/85/South-Indian_thali.jpg' },
    { kw: 'sambar rice', url: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Bisi_Bele_Bath_%28Bisibelebath%29.JPG' }
  ];

  function getAutoDishPhoto(dishName, categoryName) {
    if (!dishName) return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80';
    let trimmed = dishName.trim();

    // 1. Check Multilingual translation aliases (Telugu / Hindi)
    if (MULTILINGUAL_DISH_ALIASES[trimmed]) {
      trimmed = MULTILINGUAL_DISH_ALIASES[trimmed];
    } else {
      for (const [nativeWord, engName] of Object.entries(MULTILINGUAL_DISH_ALIASES)) {
        if (trimmed.includes(nativeWord) || nativeWord.includes(trimmed)) {
          trimmed = engName;
          break;
        }
      }
    }

    // 2. Direct dictionary match
    if (AUTHENTIC_DISH_PHOTOS[trimmed]) return AUTHENTIC_DISH_PHOTOS[trimmed];

    const lower = trimmed.toLowerCase();

    // 3. Exact case-insensitive match
    for (const [k, url] of Object.entries(AUTHENTIC_DISH_PHOTOS)) {
      if (lower === k.toLowerCase()) {
        return url;
      }
    }

    // 4. Specific keyword presets
    for (const preset of KEYWORD_PRESETS) {
      if (lower.includes(preset.kw)) {
        return preset.url;
      }
    }

    // 5. Dictionary word match
    for (const [k, url] of Object.entries(AUTHENTIC_DISH_PHOTOS)) {
      if (lower.includes(k.toLowerCase())) {
        return url;
      }
    }

    // 6. Category fallbacks
    const cat = (categoryName || '').toLowerCase();
    if (cat.includes('tiffin') || cat.includes('breakfast')) {
      return 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80';
    }
    if (cat.includes('lunch') || cat.includes('meal')) {
      return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80';
    }
    if (cat.includes('dinner') || cat.includes('curry')) {
      return 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80';
    }
    if (cat.includes('snack') || cat.includes('starter')) {
      return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80';
    }
    if (cat.includes('drink') || cat.includes('beverage')) {
      return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80';
    }

    return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80';
  }

  const BROKEN_OR_PLACEHOLDER_PHOTO_IDS = [
    'photo-1546069901-ba9599a7e63c',
    'photo-1589301764619-3c35f793b827',
    'photo-1576107232684-1279f3908594',
    'photo-1548839140-29a749e1bc4e'
  ];

  function isBrokenDishPhoto(url) {
    if (!url || typeof url !== 'string') return true;
    return BROKEN_OR_PLACEHOLDER_PHOTO_IDS.some(id => url.includes(id));
  }

  global.BROKEN_OR_PLACEHOLDER_PHOTO_IDS = BROKEN_OR_PLACEHOLDER_PHOTO_IDS;
  global.isBrokenDishPhoto = isBrokenDishPhoto;
  global.AUTHENTIC_DISH_PHOTOS = AUTHENTIC_DISH_PHOTOS;
  global.MULTILINGUAL_DISH_ALIASES = MULTILINGUAL_DISH_ALIASES;
  global.getAutoDishPhoto = getAutoDishPhoto;
})(typeof window !== 'undefined' ? window : globalThis);
