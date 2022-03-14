import {EmailAddress, EmailAddressCodec} from '../types/email-address';
import * as TE from 'fp-ts/TaskEither';
import {flow, pipe} from 'fp-ts/lib/function';
import {sequenceS} from 'fp-ts/lib/Apply';
import {formatValidationErrors} from 'io-ts-reporters';
import * as E from 'fp-ts/Either';

type Ports = {
  sendEmail: (
    email: EmailAddress,
    message: string
  ) => TE.TaskEither<string, string>;
  getMemberNumber: (email: EmailAddress) => TE.TaskEither<string, number>;
};

const validateEmail = (input: string) =>
  pipe(
    input,
    EmailAddressCodec.decode,
    E.mapLeft(flow(formatValidationErrors, errors => errors.join('\n')))
  );

const renderMessage = (memberNumber: number) => `
  Hi,

  Your Makespace member number is: ${memberNumber}.
`;

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
            memberNumber: ports.getMemberNumber(validatedEmail),
            validatedEmail: TE.right(validatedEmail),
          },
          sequenceS(TE.ApplyPar)
        )
      ),
      TE.map(({memberNumber, validatedEmail}) => ({
        validatedEmail,
        message: renderMessage(memberNumber),
      })),
      TE.chain(({message, validatedEmail}) =>
        ports.sendEmail(validatedEmail, message)
      ),
      TE.map(() => `Sent member number to ${email}`)
    );
