const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');
const fs = require('fs');

const rootDir = fs.realpathSync(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  projectRoot: rootDir,
  watchFolders: [rootDir, path.resolve(__dirname)],
  maxWorkers: 2,
};

module.exports = mergeConfig(getDefaultConfig(rootDir), config);
