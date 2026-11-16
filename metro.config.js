const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const cacheDirectory = path.join(__dirname, '.expo', 'metro-cache');

fs.mkdirSync(cacheDirectory, { recursive: true });
config.fileMapCacheDirectory = cacheDirectory;
// Preserve Expo's binary cache format while avoiding quota-limited /tmp.
config.cacheStores = config.cacheStores.map(
  (store) => new store.constructor({ root: path.join(cacheDirectory, 'transforms') })
);

config.resolver.assetExts.push('wasm');

module.exports = config;
