import {DomainEvent} from '../types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Actor} from '../types/actor';
import {readModels} from '../read-models';

export const isEquipmentTrainer =
  (equipmentId: string) =>
  (actor: Actor, events: ReadonlyArray<DomainEvent>) => {
    if (actor.tag !== 'user') {
      return false;
    }
    return pipe(
      equipmentId,
      readModels.equipment.get(events),
      O.map(({trainers}) => trainers.includes(actor.user.memberNumber)),
      O.getOrElse(() => false)
    );
  };
