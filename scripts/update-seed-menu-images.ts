import fs from 'node:fs';
import path from 'node:path';
import { getAutoDishPhoto } from '../packages/utils/src/dish-photo-matcher.ts';

const filePath = path.resolve(process.cwd(), 'services/order-service/src/seed-menu.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace items with their auto photo and timings based on category
const lines = content.split('\n');
const newLines: string[] = [];

let currentCategory = 'TIFFINS';
let currentName = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.includes('Category A: TIFFINS')) currentCategory = 'TIFFINS';
  else if (line.includes('Category B: LUNCH')) currentCategory = 'LUNCH';
  else if (line.includes('Category C: DINNER')) currentCategory = 'DINNER';
  else if (line.includes('Category D: SNACKS')) currentCategory = 'SNACKS';
  else if (line.includes('Category E: COOL DRINKS')) currentCategory = 'COOL_DRINKS';

  const nameMatch = line.match(/name:\s*'([^']+)'/);
  if (nameMatch) {
    currentName = nameMatch[1];
  }

  if (line.includes('imageUrl:') && currentName) {
    const photo = getAutoDishPhoto(currentName, currentCategory);
    newLines.push(`      imageUrl: '${photo}',`);
    continue;
  }

  if (line.includes('prepTimeMinutes:') && currentName) {
    newLines.push(line);

    // Determine serving timings
    let servingFrom = '06:00';
    let servingUntil = '23:30';

    if (currentCategory === 'TIFFINS') {
      if (['Poori', 'Pongal', 'Upma'].includes(currentName)) {
        servingFrom = '06:00';
        servingUntil = '11:30';
      } else {
        servingFrom = '06:00';
        servingUntil = '23:30';
      }
    } else if (currentCategory === 'LUNCH') {
      servingFrom = '11:00';
      servingUntil = '16:30';
    } else if (currentCategory === 'DINNER') {
      servingFrom = '18:00';
      servingUntil = '23:59';
    } else if (currentCategory === 'SNACKS') {
      servingFrom = '15:00';
      servingUntil = '23:00';
    } else if (currentCategory === 'COOL_DRINKS') {
      servingFrom = '00:00';
      servingUntil = '23:59';
    }

    newLines.push(`      servingFrom: '${servingFrom}',`);
    newLines.push(`      servingUntil: '${servingUntil}',`);
    continue;
  }

  newLines.push(line);
}

fs.writeFileSync(filePath, newLines.join('\n'));
console.log('Successfully updated seed-menu.ts with distinct photos and timings!');
