import {DomainEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../../types/command';
import {Actor} from '../../types/actor';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  revokedAt: tt.DateFromISOString,
});

type RevokeSuperUser = t.TypeOf<typeof codec>;

// eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
const process = (input: {
  command: RevokeSuperUser;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> => O.none;

const isAuthorized = (input: {
  actor: Actor;
  events: ReadonlyArray<DomainEvent>;
}) => {
  const {actor, events} = input;
  switch (actor.tag) {
    case 'token':
      return actor.token === 'admin';
    case 'user':
      return pipe(
        events,
        RA.filter(isEventOfType('SuperUserDeclared')),
        RA.some(event => event.memberNumber === actor.user.memberNumber)
      );
    default:
      return false;
  }
};

export const revoke: Command<RevokeSuperUser> = {
  process,
  decode: codec.decode,
  isAuthorized,
};
