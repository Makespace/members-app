module.exports = {
  testEnvironment: 'node',
  cacheDirectory: './.cache/jest',
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        diagnostics: false,
      },
    ],
  },
  verbose: true,
  reporters: ['jest-wip-reporter'],
  setupFiles: ['jest-date-mock'],
};
