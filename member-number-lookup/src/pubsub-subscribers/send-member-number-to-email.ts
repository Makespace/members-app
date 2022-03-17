import {EmailAddress} from '../types/email-address';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Failure} from '../types';

type Ports = {
  sendEmail: (
    emailAddress: EmailAddress,
    message: string
  ) => TE.TaskEither<Failure, string>;
  getMemberNumber: (
    emailAddress: EmailAddress
  ) => TE.TaskEither<Failure, number>;
};

const renderMessage = (memberNumber: number) => `
  Hi,

  Your Makespace member number is: ${memberNumber}.
`;

type SendMemberNumberToEmail = (
  ports: Ports
) => (emailAddress: EmailAddress) => TE.TaskEither<Failure, string>;

export const sendMemberNumberToEmail: SendMemberNumberToEmail =
  ports => emailAddress =>
    pipe(
      emailAddress,
      ports.getMemberNumber,
      TE.map(renderMessage),
      TE.chain(msg => ports.sendEmail(emailAddress, msg)),
      TE.map(() => `Sent member number to ${emailAddress}`)
    );
