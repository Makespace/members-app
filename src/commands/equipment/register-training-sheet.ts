import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {constructEvent} from '../../types';
import {Command, WithActor} from '../command';
import { isAdminSuperUserOrTrainerOrOwnerForEquipment } from '../authentication-helpers/is-admin-or-super-user-or-owner-trainer';

const codec = t.strict({
  equipmentId: tt.UUID,
  trainingSheetId: t.string,
});

export type RegisterTrainingSheet = t.TypeOf<typeof codec>;

const process = (input: {
  command: WithActor<RegisterTrainingSheet>;
}) =>
  // No idempotency check required here currently. If the training sheet already matches the current then we still record the duplicate event.
  TE.right(
    O.some(constructEvent('EquipmentTrainingSheetRegistered')(input.command))
  );

export const registerTrainingSheet: Command<RegisterTrainingSheet> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrTrainerOrOwnerForEquipment,
};
