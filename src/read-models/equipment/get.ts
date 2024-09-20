import {pipe} from 'fp-ts/lib/function';
import * as RM from 'fp-ts/ReadonlyMap';
import * as O from 'fp-ts/Option';
import {DomainEvent, SubsetOfDomainEvent, filterByName} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import {EventName, isEventOfType} from '../../types/domain-event';
import {Eq as stringEq} from 'fp-ts/string';
import {UUID} from 'io-ts-types';

export type Equipment = {
  name: string;
  id: UUID;
  trainers: ReadonlyArray<number>;
  owners: ReadonlyArray<number>;
  areaId: UUID;
  trainedMembers: ReadonlyArray<number>;
  trainingSheetId: O.Option<string>;
};

type EquipmentState = {
  name: string;
  id: UUID;
  areaId: UUID;
  trainers: Set<number>;
  trainedMembers: Set<number>;
  trainingSheetId?: string;
};

const pertinentEvents: Array<EventName> = [
  'EquipmentAdded',
  'TrainerAdded',
  'MemberTrainedOnEquipment',
  'EquipmentTrainingSheetRegistered',
];

const updateState = (
  state: Map<string, EquipmentState>,
  event: SubsetOfDomainEvent<typeof pertinentEvents>
) => {
  if (isEventOfType('EquipmentAdded')(event)) {
    state.set(event.id, {
      ...event,
      trainers: new Set(),
      trainedMembers: new Set(),
    });
  }
  if (isEventOfType('TrainerAdded')(event)) {
    const equipment = state.get(event.equipmentId);
    if (equipment) {
      state.set(event.equipmentId, {
        ...equipment,
        trainers: equipment.trainers.add(event.memberNumber),
      });
    }
  }
  if (isEventOfType('MemberTrainedOnEquipment')(event)) {
    const equipment = state.get(event.equipmentId);
    if (equipment) {
      state.set(event.equipmentId, {
        ...equipment,
        trainedMembers: equipment.trainedMembers.add(event.memberNumber),
      });
    }
  }
  if (isEventOfType('EquipmentTrainingSheetRegistered')(event)) {
    const equipment = state.get(event.equipmentId);
    if (equipment) {
      state.set(event.equipmentId, {
        ...equipment,
        trainingSheetId: event.trainingSheetId,
      });
    }
  }
  return state;
};

export const get =
  (events: ReadonlyArray<DomainEvent>) =>
  (equipmentId: string): O.Option<Equipment> =>
    pipe(
      events,
      filterByName(pertinentEvents),
      RA.reduce(new Map(), updateState),
      RM.lookup(stringEq)(equipmentId), // TODO - Do updateState lazily based on what is looked up.
      O.map(state => ({
        ...state,
        trainingSheetId: O.fromNullable(state.trainingSheetId),
        trainers: Array.from(state.trainers.values()),
        trainedMembers: Array.from(state.trainedMembers.values()),
      }))
    );
