import * as TE from 'fp-ts/TaskEither';
import {Failure} from '../types';
import {Email} from '../types/email';

type RateLimitSendingOfEmails = (email: Email) => TE.TaskEither<Failure, Email>;

export const rateLimitSendingOfEmails = (): RateLimitSendingOfEmails => email =>
  TE.right(email);
