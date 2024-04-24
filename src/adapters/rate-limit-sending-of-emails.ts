import * as TE from 'fp-ts/TaskEither';
import {Email, EmailAddress, failure, Failure} from '../types';
import * as A from 'fp-ts/Array';
import {pipe} from 'fp-ts/lib/function';
import * as B from 'fp-ts/boolean';

type PastActivity = Array<{emailAddress: EmailAddress; timestamp: number}>;

type CreateRateLimiter = (
  limit: number,
  timeWindowInSeconds: number
) => (email: Email) => TE.TaskEither<Failure, Email>;

export const createRateLimiter: CreateRateLimiter = (
  limit,
  timeWindowInSeconds
) => {
  const pastActivity: PastActivity = [];

  const recordActivityFor = (email: Email) => {
    pastActivity.push({
      emailAddress: email.recipient,
      timestamp: Date.now(),
    });
  };

  return email => {
    const startOfCurrentWindow = Date.now() - timeWindowInSeconds;
    const failureOf = (email: Email) =>
      failure('Email rate limit exceeded')({email, limitPerDay: limit});
    return pipe(
      pastActivity,
      A.filter(activity => activity.emailAddress === email.recipient),
      A.filter(({timestamp}) => timestamp >= startOfCurrentWindow),
      A.size,
      sentInCurrentWindow => sentInCurrentWindow < limit,
      B.match(
        () => TE.left(failureOf(email)),
        () => {
          recordActivityFor(email);
          return TE.right(email);
        }
      )
    );
  };
};
