// Metro con soporte de monorepo pnpm (Expo SDK 57 lo detecta solo) y archivos .sql de migraciones.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
module.exports = config;
