import * as E from 'fp-ts/Either';
import {flow, pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import {formatValidationErrors} from 'io-ts-reporters';
import {EmailAddress, EmailAddressCodec} from './types';

const BodyCodec = t.type({
  email: EmailAddressCodec,
});

export const parseEmailAddressFromBody = (
  body: unknown
): E.Either<string, EmailAddress> =>
  pipe(
    body,
    BodyCodec.decode,
    E.bimap(
      flow(formatValidationErrors, errors => errors.join('\n')),
      ({email}) => email
    )
  );
