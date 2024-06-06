import {DomainEvent, constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  equipmentId: tt.UUID,
  trainingSheetId: t.string,
});

type RegisterTrainingSheet = t.TypeOf<typeof codec>;

const process = (input: {
  command: RegisterTrainingSheet;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  // No idempotency check required here currently. If the training sheet already matches the current then we still record the duplicate event.
  O.some(constructEvent('EquipmentTrainingSheetRegistered')(input.command));

const resource = (command: RegisterTrainingSheet) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

export const registerTrainingSheet: Command<RegisterTrainingSheet> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
