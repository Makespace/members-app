import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../dependencies';
import {EmailAddress, Failure} from '../types';

const toEmail = (emailAddress: EmailAddress) => (memberNumber: number) => ({
  recipient: emailAddress,
  subject: 'Your Makespace Number',
  message: `
      Hi,

      Your Makespace member number is: ${memberNumber}.
    `,
});

type SendMemberNumberToEmail = (
  deps: Dependencies
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
