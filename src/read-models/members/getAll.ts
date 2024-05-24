import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent, isEventOfType} from '../../types';
import {pipe} from 'fp-ts/lib/function';

type Member = {
  number: number;
  email: string;
};

export const getAll = (
  events: ReadonlyArray<DomainEvent>
): ReadonlyArray<Member> =>
  pipe(
    events,
    RA.filter(isEventOfType('MemberNumberLinkedToEmail')),
    RA.map(event => ({number: event.memberNumber, email: event.email}))
  );
