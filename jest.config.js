module.exports = {
  testEnvironment: 'node',
  cacheDirectory: './.cache/jest',
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        diagnostics: false,
        isolatedModules: true,
      },
    ],
  },
  verbose: false,
  reporters: ['jest-wip-reporter'],
};
