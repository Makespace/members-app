import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {DomainEvent, isEventOfType} from '../../types';
import {pipe} from 'fp-ts/lib/function';

export const lookupByEmail =
  (email: string) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<number> =>
    pipe(
      events,
      RA.filter(isEventOfType('MemberNumberLinkedToEmail')),
      RA.findFirst(event => event.email === email),
      O.map(event => event.memberNumber)
    );
