import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'icon.png',
  'android-icon-foreground.png',
  'android-icon-monochrome.png',
  'splash-icon.png',
  'favicon.png',
  'banana-banner.jpg',
  'banana-logo.jpg',
];

let missing = 0;
for (const name of required) {
  const path = join(root, 'assets', name);
  if (!existsSync(path)) {
    console.error(`missing: assets/${name}`);
    missing += 1;
    continue;
  }
  const kb = Math.round(statSync(path).size / 1024);
  console.log(`ok: assets/${name} (${kb} KB)`);
}

if (missing > 0) {
  process.exit(1);
}

console.log('All icon and banner assets are present.');
