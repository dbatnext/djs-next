import fs from 'fs';
import path from 'path';

let localesCache: Record<string, Record<string, any>> = {};
let defaultLoc = 'en';

export function loadLocales(localesDir: string, defaultLocale?: string) {
  if (defaultLocale) defaultLoc = defaultLocale;
  
  if (!fs.existsSync(localesDir)) return;

  const files = fs.readdirSync(localesDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const lang = file.replace('.json', '');
      const content = fs.readFileSync(path.join(localesDir, file), 'utf8');
      try {
        localesCache[lang] = JSON.parse(content);
      } catch (e) {
        console.error(`[djs-next] Failed to parse locale file: ${file}`, e);
      }
    }
  }
}

export function translate(key: string, locale: string = defaultLoc, variables?: Record<string, string | number>): string {
  // Fallback to default locale if the requested one is not found
  const dict = localesCache[locale] || localesCache[defaultLoc] || {};
  
  const keys = key.split('.');
  let value: any = dict;

  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      value = undefined;
      break;
    }
  }

  if (typeof value !== 'string') {
    return key; // return the key itself if string not found
  }

  if (variables) {
    for (const [varKey, varValue] of Object.entries(variables)) {
      value = value.replace(new RegExp(`{{s*${varKey}s*}}`, 'g'), String(varValue));
    }
  }

  return value;
}

export function getLocalesCache() {
  return localesCache;
}
