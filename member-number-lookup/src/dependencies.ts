import {Logger} from 'pino';
import {EmailAddress, Failure, Email, DomainEvent} from './types';
import * as TE from 'fp-ts/TaskEither';
import {Trainer} from './types/trainer';

export type Dependencies = {
  getAllEvents: () => TE.TaskEither<Failure, ReadonlyArray<DomainEvent>>;
  getMemberNumber: (
    emailAddress: EmailAddress
  ) => TE.TaskEither<Failure, number>;
  getTrainers: () => TE.TaskEither<Failure, ReadonlyArray<Trainer>>;
  logger: Logger;
  rateLimitSendingOfEmails: (email: Email) => TE.TaskEither<Failure, Email>;
  sendEmail: (email: Email) => TE.TaskEither<Failure, string>;
};
