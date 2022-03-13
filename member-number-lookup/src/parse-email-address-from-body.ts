import * as E from 'fp-ts/Either';
import {flow, pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import {formatValidationErrors} from 'io-ts-reporters';
import {Email, EmailCodec} from './types/email';

const BodyCodec = t.type({
  email: EmailCodec,
});

export const parseEmailAddressFromBody = (
  body: unknown
): E.Either<string, Email> =>
  pipe(
    body,
    BodyCodec.decode,
    E.bimap(
      flow(formatValidationErrors, errors => errors.join('\n')),
      ({email}) => email
    )
  );
