import {pipe} from 'fp-ts/lib/function';
import PubSub from 'pubsub-js';
import * as TE from 'fp-ts/TaskEither';
import {formatValidationErrors} from 'io-ts-reporters';
import * as E from 'fp-ts/Either';
import {EmailAddressCodec, failure} from '../../types';
import {Dependencies} from '../../dependencies';
import {Config} from '../../configuration';
import * as t from 'io-ts';
import { sendEmailVerification } from './send-email-verification';

const validateEmailVerificationCodec = t.strict({
  memberNumber: t.Integer,
  emailAddress: EmailAddressCodec,
});

const validateEmailVerification = (input: unknown) =>
  pipe(
    input,
    validateEmailVerificationCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failure('Invalid validation request'))
  );

export const startVerifyEmailPubSub = (deps: Dependencies, conf: Config) => {
  PubSub.subscribe(
    'send-email-verification',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (topic, payload) => {
      await pipe(
        payload,
        validateEmailVerification,
        TE.fromEither,
        TE.chain(({memberNumber, emailAddress}) => sendEmailVerification(deps, conf)(memberNumber, emailAddress)),
        TE.match(
          failure =>
            deps.logger.error({topic, failure}, 'Failed to process message'),
          successMsg => deps.logger.info({topic, result: successMsg})
        )
      )()
    }
  )
};
