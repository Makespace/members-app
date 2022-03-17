import * as TE from 'fp-ts/TaskEither';
import {failure, Failure} from '../types';
import {Email} from '../types/email';

type RateLimitSendingOfEmails = (email: Email) => TE.TaskEither<Failure, Email>;

export const rateLimitSendingOfEmails =
  (limitPerDay: number): RateLimitSendingOfEmails =>
  email =>
    limitPerDay > 0
      ? TE.right(email)
      : TE.left(failure('Email rate limit exceeded')({email, limitPerDay}));
