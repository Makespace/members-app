import {constructEvent} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  equipmentId: tt.UUID,
  memberNumber: tt.NumberFromString,
});

export type AddTrainer = t.TypeOf<typeof codec>;

const process: Command<AddTrainer>['process'] = input =>
  pipe(
    input.events,
    RA.match(
      () => O.some(constructEvent('TrainerAdded')(input.command)),
      () => O.none
    )
  );

const resource: Command<AddTrainer>['resource'] = command => ({
  type: 'Trainers',
  id: command.equipmentId,
});

export const addTrainer: Command<AddTrainer> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
