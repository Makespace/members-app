import {Logger} from 'pino';
import {withGoogleRateLimitRetry} from '../../src/sync-worker/google/google-rate-limit-retry';
import { testLogger } from './util';

describe('withGoogleRateLimitRetry', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the request result when the request succeeds', async () => {
    const request = jest.fn(async () => 'synced');

    await expect(
      withGoogleRateLimitRetry(testLogger(), 'pull sheet data', request)
    ).resolves.toBe('synced');

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('retries when Google rate limits the request', async () => {
    jest.useFakeTimers();
    const {logger, info} = loggerWithInfoSpy();
    const rateLimitError = Object.assign(new Error('rate limited'), {code: 429});
    const request = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce('synced');

    const result = withGoogleRateLimitRetry(
      logger,
      'pull sheet data',
      request
    );

    await jest.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toBe('synced');
    expect(request).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledWith(
      'Hit rate limit for %s - retrying...',
      'pull sheet data'
    );
  });

  it('does not retry other request failures', async () => {
    const error = new Error('permission denied');
    const request = jest.fn<Promise<string>, []>().mockRejectedValue(error);

    await expect(
      withGoogleRateLimitRetry(testLogger(), 'pull sheet data', request)
    ).rejects.toBe(error);

    expect(request).toHaveBeenCalledTimes(1);
  });
});

const loggerWithInfoSpy = (): {logger: Logger; info: jest.Mock} => {
  const info = jest.fn();

  return {logger: {info} as unknown as Logger, info};
};
