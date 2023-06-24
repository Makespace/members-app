import {Logger} from 'pino';
import {EmailAddress, Failure, Email} from './types';
import * as TE from 'fp-ts/TaskEither';

export type Dependencies = {
  getMemberNumber: (
    emailAddress: EmailAddress
  ) => TE.TaskEither<Failure, number>;
  logger: Logger;
  rateLimitSendingOfEmails: (email: Email) => TE.TaskEither<Failure, Email>;
  sendEmail: (email: Email) => TE.TaskEither<Failure, string>;
};
