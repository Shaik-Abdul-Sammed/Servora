import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { SEED_CATEGORIES, createSeedMenuItems } from '../services/order-service/src/seed-menu.ts';

const cacheFile = './data/translations/cache.json';
const cache: Record<string, string> = existsSync(cacheFile)
  ? JSON.parse(readFileSync(cacheFile, 'utf-8'))
  : {};

// Comprehensive Indian Food Translation Dictionary for exact names
const NAME_MAP: Record<string, { te: string; hi: string }> = {
  'Tiffins': { te: 'టిఫిన్లు', hi: 'टिफिन / नाश्ता' },
  'Lunch': { te: 'మధ్యాహ్న భోజనం', hi: 'दोपहर का भोजन' },
  'Dinner': { te: 'రాత్రి భోజనం', hi: 'रात का खाना' },
  'Snacks': { te: 'స్నాక్స్', hi: 'స్नैक्स / अल्पाहार' },
  'Cool Drinks': { te: 'శీతల పానీయాలు', hi: 'शीतल पेय' },

  'Plain Idli': { te: 'సాదా ఇడ్లీ', hi: 'सादा इडली' },
  'Sambar Idli': { te: 'సాంబార్ ఇడ్లీ', hi: 'सांबर इडली' },
  'Ghee Idli': { te: 'నెయ్యి ఇడ్లీ', hi: 'घी इडली' },
  'Plain Dosa': { te: 'సాదా దోశ', hi: 'सादा डोसा' },
  'Masala Dosa': { te: 'మసాలా దోశ', hi: 'मसाला डोसा' },
  'Ghee Karam Dosa': { te: 'నెయ్యి కారం దోశ', hi: 'घी करम डोसा' },
  'Onion Dosa': { te: 'ఉల్లిపాయ దోశ', hi: 'प्याज डोसा' },
  'Pesarattu': { te: 'పెసరట్టు', hi: 'पेसरट्टू' },
  'Upma': { te: 'ఉప్మా', hi: 'उपमा' },
  'Poori': { te: 'పూరీ', hi: 'पूरी' },
  'Pongal': { te: 'పొంగల్', hi: 'पोंगल' },
  'Vada': { te: 'మేదు వడ', hi: 'मेदु वड़ा' },
  'Medu Vada': { te: 'మేదు వడ', hi: 'मेदु वड़ा' },

  'South Indian Meals': { te: 'దక్షిణ భారత భోజనం', hi: 'दक्षिण भारतीय भोजन' },
  'Andhra Meals': { te: 'ఆంధ్రా భోజనం', hi: 'आंध्र भोजन' },
  'Veg Meals': { te: 'శాకాహార భోజనం', hi: 'शाकाहारी भोजन' },
  'Curd Rice': { te: 'పెరుగన్నం', hi: 'दही चावल' },
  'Lemon Rice': { te: 'నిమ్మకాయ అన్నం', hi: 'नींबू चावल' },
  'Tomato Rice': { te: 'టొమాటో అన్నం', hi: 'टमाटर चावल' },
  'Veg Biryani': { te: 'వెజ్ బిర్యానీ', hi: 'वेज बिरयानी' },
  'Paneer Biryani': { te: 'పనీర్ బిర్యానీ', hi: 'पनीर बिरयानी' },
  'Chicken Biryani': { te: 'చికెన్ బిర్యానీ', hi: 'चिकन बिरयानी' },
  'Chicken Meals': { te: 'చికెన్ భోజనం', hi: 'चिकन भोजन' },
  'Sambar Rice': { te: 'సాంబార్ అన్నం', hi: 'सांबर चावल' },
  'Special Thali': { te: 'స్పెషల్ థాలీ', hi: 'स्पेशल थाली' },

  'Chapati': { te: 'చపాతీ', hi: 'चपाती' },
  'Chapati (2 Pcs)': { te: 'చపాతీ (2 ముక్కలు)', hi: 'चपाती (2 पीस)' },
  'Parotta': { te: 'మలబార్ పరోటా', hi: 'मालाबार परोटा' },
  'Malabar Parotta': { te: 'మలబార్ పరోటా', hi: 'मालाबार परोटा' },
  'Paneer Curry': { te: 'పనీర్ కర్రీ', hi: 'पनीर करी' },
  'Paneer Butter Masala': { te: 'పనీర్ బటర్ మసాలా', hi: 'पनीर बटर मसाला' },
  'Kadai Paneer': { te: 'కడాయి పనీర్', hi: 'कड़ाही पनीर' },
  'Dal Tadka': { te: 'దాల్ తడ్కా', hi: 'दाल तड़का' },
  'Veg Fried Rice': { te: 'వెజ్ ఫ్రైడ్ రైస్', hi: 'वेज फ्राइड राइस' },
  'Chicken Fried Rice': { te: 'చికెన్ ఫ్రైడ్ రైస్', hi: 'चिकन फ्राइड राइस' },
  'Veg Noodles': { te: 'వెజ్ నూడుల్స్', hi: 'वेज नूडल्स' },
  'Veg Hakka Noodles': { te: 'వెజ్ హక్కా నూడుల్స్', hi: 'वेज हक्का नूडल्स' },
  'Chicken Noodles': { te: 'చికెన్ నూడుల్స్', hi: 'चिकन नूडल्स' },
  'Butter Naan': { te: 'బటర్ నాన్', hi: 'बटर नान' },
  'Tandoori Roti': { te: 'తందూరి రోటీ', hi: 'तंदूरी रोटी' },

  'Samosa': { te: 'సమోసా', hi: 'समोसा' },
  'Samosa (2 Pcs)': { te: 'సమోసా (2 ముక్కలు)', hi: 'समोसा (2 पीस)' },
  'Punugulu': { te: 'పునుగులు', hi: 'पुनुगुलु' },
  'Mirchi Bajji': { te: 'మిర్చి బజ్జి', hi: 'मिर्ची भज्जी' },
  'Onion Pakoda': { te: 'ఉల్లిపాయ పకోడీ', hi: 'प्याज पकोड़ा' },
  'Gobi 65': { te: 'గోబీ 65', hi: 'गोभी 65' },
  'Paneer 65': { te: 'పనీర్ 65', hi: 'पनीर 65' },
  'French Fries': { te: 'క్రిస్పీ ఫ్రెంచ్ ఫ్రైస్', hi: 'कुरकुरी फ्रेंच फ्राइज़' },
  'Crispy French Fries': { te: 'క్రిస్పీ ఫ్రెంచ్ ఫ్రైస్', hi: 'कुरकुरी फ्रेंच फ्राइज़' },
  'Veg Spring Rolls': { te: 'వెజ్ స్ప్రింగ్ రోల్స్', hi: 'वेज स्प्रिंग रोल्स' },
  'Chicken 65': { te: 'చికెన్ 65', hi: 'चिकन 65' },
  'Chicken Pakoda': { te: 'చికెన్ పకోడీ', hi: 'चिकन पकोड़ा' },

  'Water Bottle': { te: 'మినరల్ వాటర్ బాటిల్', hi: 'मिनरल वाटर बोतल' },
  'Packaged Water Bottle (1L)': { te: 'ప్యాకేజ్డ్ మినరల్ వాటర్ (1లీ)', hi: 'पैकेज्ड मिनरल वाटर (1 ली)' },
  'Packaged Mineral Water (1L)': { te: 'ప్యాకేజ్డ్ మినరల్ వాటర్ (1లీ)', hi: 'पैकेज्ड मिनरल वाटर (1 ली)' },
  'Buttermilk': { te: 'మజ్జిగ', hi: 'छाछ' },
  'Masala Buttermilk': { te: 'మసాలా మజ్జిగ', hi: 'मसाला छाछ' },
  'Spiced Buttermilk': { te: 'మసాలా మజ్జిగ', hi: 'मसाला छाछ' },
  'Fresh Lime Soda': { te: 'ఫ్రెష్ లైమ్ సోడా', hi: 'फ्रेश लाइम सोडा' },
  'Fresh Sweet Lime Soda': { te: 'ఫ్రెష్ స్వీట్ లైమ్ సోడా', hi: 'फ्रेश स्वीట్ లైమ్ సోడా' },
  'Lemon Juice': { te: 'నిమ్మరసం', hi: 'नींबू का रस' },
  'Fresh Lime Juice': { te: 'ఫ్రెష్ నిమ్మరసం', hi: 'ताजा नींबू का रस' },
  'Mango Juice': { te: 'మామిడి పండ్ల రసం', hi: 'आम का रस' },
  'Alphonso Mango Juice': { te: 'మామిడి పండ్ల రసం', hi: 'अल्फांसो आम का रस' },
  'Orange Juice': { te: 'నారింజ రసం', hi: 'संतरे का रस' },
  'Fresh Orange Juice': { te: 'నారింజ రసం', hi: 'ताजा संतरे का रस' },
  'Badam Milk': { te: 'బాదం పాలు', hi: 'बादाम दूध' },
  'Royal Badam Milk': { te: 'బాదం పాలు', hi: 'रॉयल बादाम दूध' },
  'Soft Drink': { te: 'కూల్ డ్రింక్', hi: 'कोल्ड ड्रिंक' },
  'Chilled Masala Cola': { te: 'చల్లటి మసాలా కోలా', hi: 'ठंडा मसाला कोला' },
  'Filter Coffee': { te: 'ఫిల్టర్ కాఫీ', hi: 'फ़िल्टर कॉफ़ी' },
  'South Indian Filter Coffee': { te: 'ఫిల్టర్ కాఫీ', hi: 'फ़िल्टर कॉफ़ी' },
  'Cold Coffee': { te: 'కోల్డ్ కాఫీ', hi: 'कोल्ड कॉफी' }
};

// Generic description fallback generator for Telugu & Hindi
function generateTeluguDesc(item: any): string {
  const name = item.name;
  if (NAME_MAP[name]?.te) {
    return `${NAME_MAP[name].te} - తాజా పదార్థాలు మరియు సంప్రదాయ రుచులతో తయారుచేయబడిన రుచికరమైన వంటకం.`;
  }
  return 'రుచికరమైన తాజా వంటకం.';
}

function generateHindiDesc(item: any): string {
  const name = item.name;
  if (NAME_MAP[name]?.hi) {
    return `${NAME_MAP[name].hi} - ताजा सामग्री और पारंपरिक मसालों से तैयार स्वादिष्ट व्यंजन।`;
  }
  return 'स्वादिष्ट एवं ताजा व्यंजन।';
}

// 1. Map Categories
for (const cat of SEED_CATEGORIES) {
  const mapping = NAME_MAP[cat.name] || { te: cat.name, hi: cat.name };
  const teDesc = `${mapping.te} - తాజా నాణ్యమైన ఆహార పదార్థాల శ్రేణి.`;
  const hiDesc = `${mapping.hi} - ताजे एवं स्वादिष्ट व्यंजनों का संग्रह।`;

  for (const src of ['auto', 'en']) {
    cache[`${src}:te:${cat.name}`] = mapping.te;
    cache[`${src}:hi:${cat.name}`] = mapping.hi;
    if (cat.description) {
      cache[`${src}:te:${cat.description.trim()}`] = teDesc;
      cache[`${src}:hi:${cat.description.trim()}`] = hiDesc;
    }
  }
}

// 2. Map Items
const items = createSeedMenuItems('tenant1', 'outlet1');
for (const item of items) {
  const mapping = NAME_MAP[item.name] || { te: item.name, hi: item.name };
  const teDesc = generateTeluguDesc(item);
  const hiDesc = generateHindiDesc(item);

  for (const src of ['auto', 'en']) {
    cache[`${src}:te:${item.name.trim()}`] = mapping.te;
    cache[`${src}:hi:${item.name.trim()}`] = mapping.hi;
    if (item.description) {
      cache[`${src}:te:${item.description.trim()}`] = teDesc;
      cache[`${src}:hi:${item.description.trim()}`] = hiDesc;
    }
  }
}

writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
console.log(`Translation cache successfully synchronized! Total entries: ${Object.keys(cache).length}`);
