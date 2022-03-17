import * as TE from 'fp-ts/TaskEither';
import {Email, EmailAddress, failure, Failure} from '../types';
import * as A from 'fp-ts/Array';
import {pipe} from 'fp-ts/lib/function';

type RateLimitSendingOfEmails = (email: Email) => TE.TaskEither<Failure, Email>;

const pastActivity: Array<EmailAddress> = [];

export const rateLimitSendingOfEmails =
  (limitPerDay: number): RateLimitSendingOfEmails =>
  email => {
    const emailsSentToThisAddress = pipe(
      pastActivity,
      A.filter(address => address === email.recipient),
      A.size
    );

    console.log(emailsSentToThisAddress);

    if (emailsSentToThisAddress >= limitPerDay) {
      return TE.left(
        failure('Email rate limit exceeded')({email, limitPerDay})
      );
    }

    pastActivity.push(email.recipient);
    return TE.right(email);
  };
