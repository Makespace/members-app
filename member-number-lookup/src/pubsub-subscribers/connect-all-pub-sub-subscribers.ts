import {pipe} from 'fp-ts/lib/function';
import PubSub from 'pubsub-js';
import * as TE from 'fp-ts/TaskEither';
import {formatValidationErrors} from 'io-ts-reporters';
import * as E from 'fp-ts/Either';
import {EmailAddressCodec, failure} from '../types';
import {Dependencies} from '../dependencies';
import {sendLogInLink} from './send-log-in-link';
import {Config} from '../configuration';

const validateEmail = (input: unknown) =>
  pipe(
    input,
    EmailAddressCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failure('Invalid Email'))
  );

export const connectAllPubSubSubscribers = (
  deps: Dependencies,
  conf: Config
) => {
  PubSub.subscribe(
    'send-log-in-link',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (topic, payload) =>
      await pipe(
        payload,
        validateEmail,
        TE.fromEither,
        TE.chain(sendLogInLink(deps, conf)),
        TE.match(
          failure =>
            deps.logger.error({topic, failure}, 'Failed to process message'),
          successMsg => deps.logger.info({topic, result: successMsg})
        )
      )()
  );
};
