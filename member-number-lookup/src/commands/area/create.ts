import {DomainEvent, constructEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../../types/command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  id: tt.UUID,
  name: tt.NonEmptyString,
  description: t.string,
});

type CreateArea = t.TypeOf<typeof codec>;

const process = (input: {
  command: CreateArea;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  pipe(
    input.events,
    RA.filter(isEventOfType('AreaCreated')),
    RA.filter(event => event.name === input.command.name),
    RA.match(
      () => O.some(constructEvent('AreaCreated')(input.command)),
      () => O.none
    )
  );

export const create: Command<CreateArea> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
