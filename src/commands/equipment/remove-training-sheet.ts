import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {DomainEvent, constructEvent} from '../../types';
import {Actor} from '../../types/actor';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {isEquipmentTrainer} from '../is-equipment-trainer';
import {isEquipmentOwner} from '../is-equipment-owner';

const codec = t.strict({
  equipmentId: tt.UUID,
});

type RemoveTrainingSheet = t.TypeOf<typeof codec>;

const process = (input: {
  command: RemoveTrainingSheet;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  O.some(constructEvent('EquipmentTrainingSheetRemoved')(input.command));

const resource = (command: RemoveTrainingSheet) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

const isAuthorized = (input: {
  actor: Actor;
  events: ReadonlyArray<DomainEvent>;
  input: RemoveTrainingSheet;
}) =>
  isAdminOrSuperUser(input) ||
  isEquipmentTrainer(input.input.equipmentId)(input.actor, input.events) ||
  isEquipmentOwner(input.input.equipmentId)(input.actor, input.events);

export const removeTrainingSheet: Command<RemoveTrainingSheet> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized,
};
