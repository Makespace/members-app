import * as E from 'fp-ts/Either';
import {flow, pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import {formatValidationErrors} from 'io-ts-reporters';

const ParamsCodec = t.type({
  email: t.string,
});

export const sendMemberNumberByEmail = (
  params: unknown
): E.Either<string, string> =>
  pipe(
    params,
    ParamsCodec.decode,
    E.mapLeft(flow(formatValidationErrors, errors => errors.join('\n'))),
    E.map(() => 'foo')
  );
