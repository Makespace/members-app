import * as E from 'fp-ts/Either';
import {flow, pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import {formatValidationErrors} from 'io-ts-reporters';
import {Email, EmailCodec} from './email';

const ParamsCodec = t.type({
  email: EmailCodec,
});

export const sendMemberNumberByEmail = (
  params: unknown
): E.Either<string, Email> =>
  pipe(
    params,
    ParamsCodec.decode,
    E.bimap(
      flow(formatValidationErrors, errors => errors.join('\n')),
      ({email}) => email
    )
  );
