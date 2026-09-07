const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const fs = require('fs');
const path = require('path');

const realRoot = fs.realpathSync(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  projectRoot: realRoot,
  watchFolders: [
    realRoot,
    path.resolve(__dirname),
  ],
};

module.exports = mergeConfig(getDefaultConfig(realRoot), config);
