import {flow, pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import {User} from '../types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {Dependencies} from '../dependencies';
import {formatValidationErrors} from 'io-ts-reporters';

const SessionCodec = t.strict({
  passport: t.strict({
    user: User,
  }),
});

export const getUserFromSession =
  (deps: Dependencies) =>
  (session: unknown): O.Option<User> =>
    pipe(
      session,
      flow(
        SessionCodec.decode,
        E.mapLeft(formatValidationErrors),
        E.mapLeft(errors =>
          deps.logger.debug('Failed to get user from session', {errors})
        )
      ),
      E.map(session => ({
        emailAddress: session.passport.user.emailAddress,
        memberNumber: session.passport.user.memberNumber,
      })),
      O.fromEither
    );
