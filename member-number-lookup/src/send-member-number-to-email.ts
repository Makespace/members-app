import {Email, EmailCodec} from './email';
import * as TE from 'fp-ts/TaskEither';
import {flow, pipe} from 'fp-ts/lib/function';
import {sequenceS} from 'fp-ts/lib/Apply';
import {formatValidationErrors} from 'io-ts-reporters';
import * as E from 'fp-ts/Either';

type Ports = {
  sendMemberNumberEmail: (
    email: Email,
    memberNumber: number
  ) => TE.TaskEither<string, void>;
  getMemberNumberForEmail: (email: Email) => TE.TaskEither<string, number>;
};

const validateEmail = (input: string) =>
  pipe(
    input,
    EmailCodec.decode,
    E.mapLeft(flow(formatValidationErrors, errors => errors.join('\n')))
  );

type SendMemberNumberToEmail = (
  ports: Ports
) => (email: string) => TE.TaskEither<string, string>;

export const sendMemberNumberToEmail: SendMemberNumberToEmail =
  ports => email =>
    pipe(
      email,
      validateEmail,
      TE.fromEither,
      TE.chain(validatedEmail =>
        pipe(
          {
            memberNumber: ports.getMemberNumberForEmail(validatedEmail),
            validatedEmail: TE.right(validatedEmail),
          },
          sequenceS(TE.ApplyPar)
        )
      ),
      TE.chain(({memberNumber, validatedEmail}) =>
        ports.sendMemberNumberEmail(validatedEmail, memberNumber)
      ),
      TE.map(() => `Successfully sent member number to ${email}`)
    );
