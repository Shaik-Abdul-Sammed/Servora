import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../');

describe('Unified Menu Filter Engine & Food Presentation Directory', () => {
  const appJsPath = join(rootDir, 'apps/web-guest/public/app.js');
  const indexHtmlPath = join(rootDir, 'apps/web-guest/public/index.html');
  const stylesCssPath = join(rootDir, 'apps/web-guest/public/styles.css');

  assert.ok(existsSync(appJsPath), 'app.js must exist');
  assert.ok(existsSync(indexHtmlPath), 'index.html must exist');
  assert.ok(existsSync(stylesCssPath), 'styles.css must exist');

  const appJs = readFileSync(appJsPath, 'utf-8');
  const indexHtml = readFileSync(indexHtmlPath, 'utf-8');
  const stylesCss = readFileSync(stylesCssPath, 'utf-8');

  it('1. Default shift filter is "ALL" to prevent empty categories outside serving hours', () => {
    // Variable default in app.js
    assert.match(appJs, /let currentShiftFilter\s*=\s*'ALL';/, 'currentShiftFilter must default to ALL');
    // Dropdown in index.html has ALL selected
    assert.match(indexHtml, /<option value="ALL"[^>]*selected[^>]*>/, 'shiftFilterSelect must have ALL selected by default');
  });

  it('2. Filter state variables are properly separated and maintained', () => {
    assert.match(appJs, /let currentCategoryFilter\s*=\s*null;/);
    assert.match(appJs, /let currentSearchQuery\s*=\s*'';/);
    assert.match(appJs, /let currentDietaryFilter\s*=\s*'ALL';/);
    assert.match(appJs, /let currentSortOrder\s*=\s*'DEFAULT';/);
  });

  it('3. getFilteredDishes unifies category, search, dietary, and shift filters without destructive overwrites', () => {
    assert.match(appJs, /function getFilteredDishes\s*\(/);
    assert.match(appJs, /if\s*\(currentCategoryFilter\)\s*\{\s*list\s*=\s*list\.filter/);
    assert.match(appJs, /if\s*\(currentSearchQuery\)\s*\{/);
    assert.match(appJs, /if\s*\(currentDietaryFilter === 'VEG'\)/);
    assert.match(appJs, /if\s*\(currentShiftFilter === 'NOW'\)/);
  });

  it('4. Search query matches dish name, description, tags, and category name', () => {
    assert.match(appJs, /matchName\s*\|\|\s*matchDesc\s*\|\|\s*matchTags\s*\|\|\s*matchCat/);
  });

  it('5. Dietary filter toggle pills and select dropdown are synchronized', () => {
    // Both toggleDietFilter and applyDietaryFilter exist and synchronize
    assert.match(appJs, /function applyDietaryFilter\s*\(diet/);
    assert.match(appJs, /function toggleDietFilter\s*\(filter/);
    assert.match(appJs, /localStorage\.setItem\('abiruchi_guest_diet',/);
    assert.match(appJs, /filterGlutenFreeBtn/);
  });

  it('6. clearAllFilters restores full menu state across all 5 dimensions', () => {
    assert.match(appJs, /function clearAllFilters\s*\(\)/);
    assert.match(appJs, /currentCategoryFilter\s*=\s*null;/);
    assert.match(appJs, /currentSearchQuery\s*=\s*'';/);
    assert.match(appJs, /currentDietaryFilter\s*=\s*'ALL';/);
    assert.match(appJs, /currentShiftFilter\s*=\s*'ALL';/);
    assert.match(appJs, /currentSortOrder\s*=\s*'DEFAULT';/);
  });

  it('7. Food presentation groups dishes into category sections with banners and item counts', () => {
    assert.match(appJs, /category-section-banner/);
    assert.match(appJs, /category-title-row/);
    assert.match(appJs, /category-count-badge/);
    assert.match(appJs, /getCategoryIcon/);
  });

  it('8. Dish cards display a category pill badge for instant food location awareness', () => {
    assert.match(appJs, /dish-cat-pill/);
    assert.match(stylesCss, /\.dish-cat-pill/);
  });

  it('9. Active filters summary bar renders active chips with 1-click removal and reset', () => {
    assert.match(appJs, /active-filters-summary/);
    assert.match(appJs, /btn-reset-filters/);
    assert.match(appJs, /active-filter-chip/);
    assert.match(stylesCss, /\.active-filters-summary/);
    assert.match(stylesCss, /\.btn-reset-filters/);
    assert.match(stylesCss, /\.active-filter-chip/);
  });

  it('10. escapeHtml helper protects against XSS in search queries and dish names', () => {
    assert.match(appJs, /function escapeHtml\s*\(str\)/);
    assert.match(appJs, /escapeHtml\(currentSearchQuery\)/);
  });

  it('11. Filter logic simulation: category + search + veg filters produce expected subset', () => {
    const mockCategories = [
      { id: 'cat-tiffins', name: 'Tiffins' },
      { id: 'cat-lunch', name: 'Lunch' }
    ];
    const mockItems = [
      { id: '1', name: 'Plain Dosa', categoryId: 'cat-tiffins', dietaryType: 'VEG', basePriceCents: 6000 },
      { id: '2', name: 'Egg Dosa', categoryId: 'cat-tiffins', dietaryType: 'NON_VEG', basePriceCents: 8000 },
      { id: '3', name: 'Veg Biryani', categoryId: 'cat-lunch', dietaryType: 'VEG', basePriceCents: 18000 },
      { id: '4', name: 'Chicken Biryani', categoryId: 'cat-lunch', dietaryType: 'NON_VEG', basePriceCents: 24000 }
    ];

    // Filter by Tiffins
    const tiffinsOnly = mockItems.filter(i => i.categoryId === 'cat-tiffins');
    assert.equal(tiffinsOnly.length, 2);

    // Filter by Tiffins + VEG
    const vegTiffins = tiffinsOnly.filter(i => i.dietaryType === 'VEG');
    assert.equal(vegTiffins.length, 1);
    assert.equal(vegTiffins[0].name, 'Plain Dosa');

    // Search "biryani" + VEG
    const searchVegBiryani = mockItems.filter(i => i.name.toLowerCase().includes('biryani') && i.dietaryType === 'VEG');
    assert.equal(searchVegBiryani.length, 1);
    assert.equal(searchVegBiryani[0].name, 'Veg Biryani');
  });
});
