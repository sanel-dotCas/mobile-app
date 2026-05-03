// Stub out the Expo winter runtime's import.meta registry so that
// jest-expo's module scope guard does not throw when loading test files.
if (typeof globalThis.__ExpoImportMetaRegistry === 'undefined') {
  Object.defineProperty(globalThis, '__ExpoImportMetaRegistry', {
    configurable: true,
    writable: true,
    value: {},
  });
}
