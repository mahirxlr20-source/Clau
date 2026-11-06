// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The Excel trackers ship inside the app (mobile/assets/trackers) and are shared from there.
config.resolver.assetExts.push('xlsx');

module.exports = config;
