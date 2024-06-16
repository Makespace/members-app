import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {
  MemberDetails,
  RequiredMemberDetails,
  OptionalMemberDetails,
  DomainEvent,
  isEventOfType,
} from '../../types';

const getOptionalDetails =
  (memberNumber: number) =>
  (events: ReadonlyArray<DomainEvent>): OptionalMemberDetails =>
    pipe(
      events,
      RA.filter(isEventOfType('MemberDetailsUpdated')),
      RA.filter(e => e.memberNumber === memberNumber),
      RA.map(e => ({
        name: O.fromNullable(e.name),
        pronouns: O.fromNullable(e.pronouns),
      })),
      RA.reduce(
        {
          name: O.none as O.Option<string>,
          pronouns: O.none as O.Option<string>,
        },
        (l, r) => ({
          name: pipe(
            r.name,
            O.orElse(() => l.name)
          ),
          pronouns: pipe(
            r.pronouns,
            O.orElse(() => l.pronouns)
          ),
        })
      )
    );

const getRequiredDetails =
  (memberNumber: number) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<RequiredMemberDetails> =>
    pipe(
      events,
      RA.filter(isEventOfType('MemberNumberLinkedToEmail')),
      RA.findFirst(event => event.memberNumber === memberNumber),
      O.map(event => ({
        email: event.email,
        memberNumber,
      }))
    );

export const getDetails =
  (memberNumber: number) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<MemberDetails> =>
    pipe(
      getRequiredDetails(memberNumber)(events),
      O.map(d => Object.assign({}, d, getOptionalDetails(memberNumber)(events)))
    );
