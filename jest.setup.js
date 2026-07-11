/* eslint-disable no-undef */
// async-storage 2.x (SDK-54-aligned) exposes the mock at jest/async-storage-mock
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
