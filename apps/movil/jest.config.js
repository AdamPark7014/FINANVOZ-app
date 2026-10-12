module.exports = {
  preset: 'jest-expo/android',
  testMatch: ['<rootDir>/app/**/*.test.tsx', '<rootDir>/src/**/*.test.tsx'],
  // Las pruebas de pantallas abren una base SQLite real, migran y cargan semillas: en los runners de CI un
  // flujo completo (registrar, corregir, revisar historial) rebasa los 5 s por defecto de jest.
  testTimeout: 30000,
};
