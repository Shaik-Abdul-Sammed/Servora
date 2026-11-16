import { en } from './locales/en.ts';
import { hi } from './locales/hi.ts';
import { te } from './locales/te.ts';

export type SupportedLocale = 'en' | 'hi' | 'te';

export const locales = { en, hi, te };

export function getDictionary(locale: SupportedLocale = 'en') {
  return locales[locale] || locales.en;
}

export * from './locales/en.ts';
export * from './locales/hi.ts';
export * from './locales/te.ts';
