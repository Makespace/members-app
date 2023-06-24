import {pipe} from 'fp-ts/lib/function';
import {sendMemberNumberToEmail} from './send-member-number-to-email';
import PubSub from 'pubsub-js';
import * as TE from 'fp-ts/TaskEither';
import {formatValidationErrors} from 'io-ts-reporters';
import * as E from 'fp-ts/Either';
import {EmailAddressCodec, failure} from '../types';
import {Dependencies} from '../dependencies';

const validateEmail = (input: unknown) =>
  pipe(
    input,
    EmailAddressCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failure('Invalid Email'))
  );

export const connectAllPubSubSubscribers = (deps: Dependencies) => {
  PubSub.subscribe(
    'send-member-number-to-email',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (topic, payload) =>
      await pipe(
        payload,
        validateEmail,
        TE.fromEither,
        TE.chain(sendMemberNumberToEmail(deps)),
        TE.match(
          failure =>
            deps.logger.error({topic, failure}, 'Failed to process message'),
          successMsg => deps.logger.info({topic, result: successMsg})
        )
      )()
  );
};
