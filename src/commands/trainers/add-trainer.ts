import {DomainEvent, constructEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {Actor} from '../../types/actor';
import {readModels} from '../../read-models';

const codec = t.strict({
  equipmentId: tt.UUID,
  memberNumber: tt.NumberFromString,
});

export type AddTrainer = t.TypeOf<typeof codec>;

const process: Command<AddTrainer>['process'] = input =>
  pipe(
    input.events,
    RA.filter(isEventOfType('TrainerAdded')),
    RA.filter(event => event.memberNumber === input.command.memberNumber),
    RA.match(
      () => O.some(constructEvent('TrainerAdded')(input.command)),
      () => O.none
    )
  );

const resource: Command<AddTrainer>['resource'] = command => ({
  type: 'Trainers',
  id: command.equipmentId,
});

const isOwnerOfEquipment = (
  equipmentId: string,
  actor: Actor,
  events: ReadonlyArray<DomainEvent>
) => {
  if (actor.tag !== 'user') {
    return false;
  }
  return pipe(
    equipmentId,
    readModels.equipment.get(events),
    O.map(({areaId}) =>
      readModels.areas.isOwner(events)(areaId, actor.user.memberNumber)
    ),
    foo => foo,
    O.getOrElse(() => false)
  );
};

const isAdminOrSuperUserOrEquipmentUser: Command<AddTrainer>['isAuthorized'] =
  ({input, actor, events}) => {
    return (
      isAdminOrSuperUser({actor, events}) ||
      isOwnerOfEquipment(input.equipmentId, actor, events)
    );
  };

export const addTrainer: Command<AddTrainer> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUserOrEquipmentUser,
};
