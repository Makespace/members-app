import * as TE from 'fp-ts/TaskEither';
import {Email, EmailAddress, failure, Failure} from '../types';
import * as A from 'fp-ts/Array';
import {pipe} from 'fp-ts/lib/function';
import * as B from 'fp-ts/boolean';

type PastActivity = Array<{emailAddress: EmailAddress; timestamp: number}>;

type RateLimitSendingOfEmails = (email: Email) => TE.TaskEither<Failure, Email>;

export const rateLimitSendingOfEmails = (
  limit: number,
  timeWindowInSeconds = 86400
): RateLimitSendingOfEmails => {
  const pastActivity: PastActivity = [];

  return email => {
    const startOfCurrentWindow = Date.now() - timeWindowInSeconds;
    return pipe(
      pastActivity,
      A.filter(activity => activity.emailAddress === email.recipient),
      A.filter(({timestamp}) => timestamp >= startOfCurrentWindow),
      A.size,
      sentInCurrentWindow => sentInCurrentWindow < limit,
      B.match(
        () =>
          TE.left(
            failure('Email rate limit exceeded')({email, limitPerDay: limit})
          ),
        () => {
          pastActivity.push({
            emailAddress: email.recipient,
            timestamp: Date.now(),
          });
          return TE.right(email);
        }
      )
    );
  };
};
