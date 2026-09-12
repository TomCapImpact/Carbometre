import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const localesDir = fileURLToPath(new URL('../_locales', import.meta.url));

function readKeys(locale) {
  const raw = readFileSync(`${localesDir}/${locale}/messages.json`, 'utf8');
  return new Set(Object.keys(JSON.parse(raw)));
}

const en = readKeys('en');
const fr = readKeys('fr');

const missingInFr = [...en].filter((key) => !fr.has(key));
const missingInEn = [...fr].filter((key) => !en.has(key));

if (missingInFr.length > 0 || missingInEn.length > 0) {
  if (missingInFr.length > 0) {
    console.error(`Missing in _locales/fr/messages.json: ${missingInFr.join(', ')}`);
  }
  if (missingInEn.length > 0) {
    console.error(`Missing in _locales/en/messages.json: ${missingInEn.join(', ')}`);
  }
  process.exit(1);
}

console.log(`i18n catalogs match: ${en.size} keys in both en and fr.`);
