import {EmailAddress, EmailAddressCodec} from '../types/email-address';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {sequenceS} from 'fp-ts/lib/Apply';
import {formatValidationErrors} from 'io-ts-reporters';
import * as E from 'fp-ts/Either';
import {failure, Failure} from '../types';

type Ports = {
  sendEmail: (
    emailAddress: EmailAddress,
    message: string
  ) => TE.TaskEither<Failure, string>;
  getMemberNumber: (
    emailAddress: EmailAddress
  ) => TE.TaskEither<Failure, number>;
};

const validateEmail = (input: string) =>
  pipe(
    input,
    EmailAddressCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failure('Invalid Email'))
  );

const renderMessage = (memberNumber: number) => `
  Hi,

  Your Makespace member number is: ${memberNumber}.
`;

type SendMemberNumberToEmail = (
  ports: Ports
) => (email: string) => TE.TaskEither<Failure, string>;

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
      TE.chainW(({message, validatedEmail}) =>
        ports.sendEmail(validatedEmail, message)
      ),
      TE.map(() => `Sent member number to ${email}`)
    );
