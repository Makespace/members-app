import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent, EmailAddress, isEventOfType} from '../../types';
import {pipe} from 'fp-ts/lib/function';

export const lookupByCaseInsensitiveEmail =
  (email: string) =>
  (
    events: ReadonlyArray<DomainEvent>
  ): ReadonlyArray<{emailAddress: EmailAddress; memberNumber: number}> =>
    pipe(
      events,
      RA.filter(isEventOfType('MemberNumberLinkedToEmail')),
      RA.filter(event => event.email.toLowerCase() === email.toLowerCase()),
      RA.map(({memberNumber, email}) => ({memberNumber, emailAddress: email}))
    );
