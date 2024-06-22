import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {MemberDetails, DomainEvent, filterByName} from '../../types';
import {getAllDetails, pertinentEvents} from './get-all';

export const getDetails =
  (memberNumber: number) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<MemberDetails> =>
    pipe(
      events,
      filterByName(pertinentEvents),
      RA.filter(e => e.memberNumber === memberNumber),
      getAllDetails,
      allDetails => O.fromNullable(allDetails.get(memberNumber))
    );
