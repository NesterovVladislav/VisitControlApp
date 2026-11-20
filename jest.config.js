module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: { '^expo-asset$': require.resolve('expo-asset', { paths: [require.resolve('expo/package.json')] }) },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|immer))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
};
