import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import {User} from '../types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';

const SessionCodec = t.strict({
  passport: t.strict({
    user: User,
  }),
});

export const getUserFromSession = (session: unknown): O.Option<User> =>
  pipe(
    session,
    SessionCodec.decode,
    E.map(session => ({
      emailAddress: session.passport.user.emailAddress,
      memberNumber: session.passport.user.memberNumber,
    })),
    O.fromEither
  );
