// This is independent of the rest of the code so that it can execute in isolation first
// as per https://docs.sentry.io/platforms/javascript/guides/node/install/esm/.

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;

// Ensure to call this before importing any other modules!
if (SENTRY_DSN) {
  console.log('Setting up sentry...');
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
} else {
  console.log('Skipped sentry setup, SENTRY_DSN not provided');
}
