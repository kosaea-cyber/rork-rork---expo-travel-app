module.exports = function (api) {
  api.cache(true);
  console.log("✅ babel.config.js loaded");
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'expo-router/babel',
      'react-native-reanimated/plugin',
    ],
  };
};
