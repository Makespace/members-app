import {DomainEvent, constructEvent} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  equipmentId: tt.UUID,
  trainingSheetId: t.string,
});

type AddTrainingSheet = t.TypeOf<typeof codec>;

const process = (input: {
  command: AddTrainingSheet;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  pipe(
    input.events,
    RA.match(
      () => O.some(constructEvent('EquipmentTrainingSheetAdded')(input.command)),
      () => O.none
    )
  );

const resource = (command: AddTrainingSheet) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

export const addTrainingSheet: Command<AddTrainingSheet> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
