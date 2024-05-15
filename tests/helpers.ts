import {error} from 'console';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';

export const getRightOrFail = <A>(input: E.Either<unknown, A>): A =>
  pipe(
    input,
    E.getOrElseW(left => {
      error(left);
      throw new Error('unexpected Left');
    })
  );

export const getSomeOrFail = <A>(input: O.Option<A>): A =>
  pipe(
    input,
    O.getOrElseW(() => {
      throw new Error('unexpected None');
    })
  );
