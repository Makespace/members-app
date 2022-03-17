import {EmailAddress} from '../types/email-address';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Failure} from '../types';
import {Email} from '../types/email';

type Ports = {
  getMemberNumber: (
    emailAddress: EmailAddress
  ) => TE.TaskEither<Failure, number>;
  rateLimitSendingOfEmails: (email: Email) => TE.TaskEither<Failure, Email>;
  sendEmail: (email: Email) => TE.TaskEither<Failure, string>;
};

const toEmail = (emailAddress: EmailAddress) => (memberNumber: number) => ({
  recipient: emailAddress,
  subject: 'Your Makespace Number',
  message: `
      Hi,

      Your Makespace member number is: ${memberNumber}.
    `,
});

type SendMemberNumberToEmail = (
  ports: Ports
) => (emailAddress: EmailAddress) => TE.TaskEither<Failure, string>;

export const sendMemberNumberToEmail: SendMemberNumberToEmail =
  ports => emailAddress =>
    pipe(
      emailAddress,
      ports.getMemberNumber,
      TE.map(toEmail(emailAddress)),
      TE.chain(ports.rateLimitSendingOfEmails),
      TE.chain(ports.sendEmail),
      TE.map(() => `Sent member number to ${emailAddress}`)
    );
