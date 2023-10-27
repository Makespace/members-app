import {DomainEvent, constructEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../../types/command';
import {Actor} from '../../types/actor';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  declaredAt: tt.DateFromISOString,
});

type DeclareSuperUserCommand = t.TypeOf<typeof codec>;

const process = (input: {
  command: DeclareSuperUserCommand;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  pipe(
    input.events,
    RA.filter(isEventOfType('SuperUserDeclared')),
    RA.filter(event => event.memberNumber === input.command.memberNumber),
    RA.match(
      () => O.some(constructEvent('SuperUserDeclared')(input.command)),
      () => O.none
    )
  );

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

export const declare: Command<DeclareSuperUserCommand> = {
  process,
  decode: codec.decode,
  isAuthorized,
};