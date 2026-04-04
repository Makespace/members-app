import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import { isAdminSuperUserOrOwnerForEquipment } from '../authentication-helpers/is-admin-or-super-user-or-owner';

const codec = t.strict({
  equipmentId: tt.UUID,
  memberNumber: tt.NumberFromString,
});

export type AddTrainer = t.TypeOf<typeof codec>;

const process: Command<AddTrainer>['process'] = input =>
  TE.right(O.some(constructEvent('TrainerAdded')(input.command)));

const resource: Command<AddTrainer>['resource'] = command => ({
  type: 'Trainers',
  id: command.equipmentId,
});

export const addTrainer: Command<AddTrainer> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrOwnerForEquipment,
};
