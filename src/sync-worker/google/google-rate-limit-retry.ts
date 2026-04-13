import {backOff} from 'exponential-backoff';
import {Logger} from 'pino';

export const withGoogleRateLimitRetry = async <T>(
  logger: Logger,
  description: string,
  request: () => Promise<T>,
): Promise<T> =>
  backOff(request, {
    jitter: 'none',
    maxDelay: 30_000,
    numOfAttempts: 10,
    startingDelay: 2_000,
    timeMultiple: 2,
    retry: (err: unknown, _attempt) => {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 429) {
        logger.info(`Hit rate limit for %s - retrying...`, description);
        return true;
      }
      return false;
    },
  });
