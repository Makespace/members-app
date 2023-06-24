import {pipe} from 'fp-ts/lib/function';
import {sendMemberNumberToEmail} from './send-member-number-to-email';
import PubSub from 'pubsub-js';
import * as TE from 'fp-ts/TaskEither';
import {Logger} from 'pino';
import {
  sendEmail,
  getMemberNumber,
  getMemberNumberStubbed,
  createRateLimiter,
} from '../adapters';
import {formatValidationErrors} from 'io-ts-reporters';
import * as E from 'fp-ts/Either';
import {EmailAddressCodec, failure} from '../types';

let adapters = {
  getMemberNumber: getMemberNumber(),
  rateLimitSendingOfEmails: createRateLimiter(5, 24 * 3600),
  sendEmail: sendEmail(),
};

if (process.env.USE_STUBBED_ADAPTERS === 'true') {
  adapters = {
    ...adapters,
    getMemberNumber: getMemberNumberStubbed(),
  };
}

const validateEmail = (input: unknown) =>
  pipe(
    input,
    EmailAddressCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failure('Invalid Email'))
  );

export const connectAllPubSubSubscribers = (logger: Logger) => {
  PubSub.subscribe(
    'send-member-number-to-email',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (topic, payload) =>
      await pipe(
        payload,
        validateEmail,
        TE.fromEither,
        TE.chain(sendMemberNumberToEmail(adapters)),
        TE.match(
          failure =>
            logger.error({topic, failure}, 'Failed to process message'),
          successMsg => logger.info({topic, result: successMsg})
        )
      )()
  );
};
