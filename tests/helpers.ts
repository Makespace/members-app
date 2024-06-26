import {error} from 'console';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {identity, pipe} from 'fp-ts/lib/function';
import {Actor, UserActor} from '../src/types/actor';
import {EmailAddressCodec} from '../src/types/email-address';

export const getRightOrFail = <A>(input: E.Either<unknown, A>): A =>
  pipe(
    input,
    E.getOrElseW(left => {
      error(left);
      throw new Error('unexpected Left');
    })
  );

export const getLeftOrFail = <E>(input: E.Either<E, unknown>): E =>
  pipe(
    input,
    E.match(identity, () => {
      throw new Error('unexpected Right');
    })
  );

export const getSomeOrFail = <A>(input: O.Option<A>): A =>
  pipe(
    input,
    O.getOrElseW(() => {
      throw new Error('unexpected None');
    })
  );

export const arbitraryActor = (): Actor =>
  ({tag: 'token', token: 'admin'}) satisfies Actor;

export const tokenActor = arbitraryActor;

export const systemActor = (): Actor => ({tag: 'system'}) satisfies Actor;

export const userActor = (): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: getRightOrFail(EmailAddressCodec.decode('test@test.com')),
    memberNumber: 12,
  },
});
