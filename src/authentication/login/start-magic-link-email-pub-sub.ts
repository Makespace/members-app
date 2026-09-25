import {pipe} from 'fp-ts/lib/function';
import PubSub from 'pubsub-js';
import * as TE from 'fp-ts/TaskEither';
import {formatValidationErrors} from 'io-ts-reporters';
import * as E from 'fp-ts/Either';
import * as t from 'io-ts';
import {EmailAddressCodec, failure} from '../../types';
import {Dependencies} from '../../dependencies';
import {sendLogInLink} from './send-log-in-link';
import {Config} from '../../configuration';

// The handler has already worked out whether it was given an address or a
// number; this only guards against a malformed message on the bus.
const IdentifierCodec = t.union([
  t.type({tag: t.literal('email'), email: EmailAddressCodec}),
  t.type({tag: t.literal('memberNumber'), memberNumber: t.number}),
]);

const validateIdentifier = (input: unknown) =>
  pipe(
    input,
    IdentifierCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failure('Invalid log in request'))
  );

export const startMagicLinkEmailPubSub = (deps: Dependencies, conf: Config) => {
  PubSub.subscribe(
    'send-log-in-link',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (topic, payload) =>
      await pipe(
        payload,
        validateIdentifier,
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
