import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {DomainEvent, constructEvent} from '../../types';
import {Command, WithActor} from '../command';
import { isAdminSuperUserOrTrainerOrOwnerForEquipment } from '../authentication-helpers/is-admin-or-super-user-or-owner-trainer';

const codec = t.strict({
  equipmentId: tt.UUID,
});

type RemoveTrainingSheet = t.TypeOf<typeof codec>;

const process = (input: {
  command: WithActor<RemoveTrainingSheet>;
  events: ReadonlyArray<DomainEvent>;
}) =>
  TE.right(
    O.some(constructEvent('EquipmentTrainingSheetRemoved')(input.command))
  );

const resource = (command: RemoveTrainingSheet) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

export const removeTrainingSheet: Command<RemoveTrainingSheet> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrTrainerOrOwnerForEquipment,
};
