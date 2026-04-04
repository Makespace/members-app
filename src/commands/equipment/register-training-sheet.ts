import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {DomainEvent, constructEvent} from '../../types';
import {Command, WithActor} from '../command';
import { isAdminSuperUserOrTrainerOrOwnerForEquipment } from '../authentication-helpers/is-admin-or-super-user-or-owner-trainer';

const codec = t.strict({
  equipmentId: tt.UUID,
  trainingSheetId: t.string,
});

export type RegisterTrainingSheet = t.TypeOf<typeof codec>;

const process = (input: {
  command: WithActor<RegisterTrainingSheet>;
  events: ReadonlyArray<DomainEvent>;
}) =>
  // No idempotency check required here currently. If the training sheet already matches the current then we still record the duplicate event.
  TE.right(
    O.some(constructEvent('EquipmentTrainingSheetRegistered')(input.command))
  );

const resource = (command: RegisterTrainingSheet) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

export const registerTrainingSheet: Command<RegisterTrainingSheet> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrTrainerOrOwnerForEquipment,
};
