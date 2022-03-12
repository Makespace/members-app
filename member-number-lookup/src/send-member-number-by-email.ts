import * as E from 'fp-ts/Either';
import {flow, pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import {formatValidationErrors} from 'io-ts-reporters';
import {Email, EmailCodec} from './email';
import * as TE from 'fp-ts/TaskEither';

const ParamsCodec = t.type({
  email: EmailCodec,
});

type Ports = {
  getMemberNumberForEmail: (email: Email) => TE.TaskEither<string, number>;
};

export const sendMemberNumberByEmail =
  (ports: Ports) =>
  (params: unknown): TE.TaskEither<string, Email> =>
    pipe(
      params,
      ParamsCodec.decode,
      E.bimap(
        flow(formatValidationErrors, errors => errors.join('\n')),
        ({email}) => email
      ),
      TE.fromEither,
      TE.chainFirst(ports.getMemberNumberForEmail)
    );
