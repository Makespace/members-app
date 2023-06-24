import {Dependencies} from '../dependencies';
import {getMemberNumber} from './get-member-number';
import {getMemberNumberStubbed} from './get-member-number-stubbed';
import {createRateLimiter} from './rate-limit-sending-of-emails';
import {sendEmail} from './send-email';
import createLogger from 'pino';

export const createAdapters = (): Dependencies => {
  const logger = createLogger({
    formatters: {
      level: label => {
        return {severity: label};
      },
    },
  });

  return {
    getMemberNumber:
      process.env.USE_STUBBED_ADAPTERS === 'true'
        ? getMemberNumberStubbed()
        : getMemberNumber(),
    rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
    sendEmail: sendEmail(),
    logger,
  };
};
