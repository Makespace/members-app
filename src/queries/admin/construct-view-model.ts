import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {DateTime} from 'luxon';
import {Dependencies} from '../../dependencies';
import {User} from '../../types';
import {FailureWithStatus} from '../../types/failure-with-status';
import {
  QuarterCount,
  trainingsByQuarter,
} from '../../read-models/shared-state/member/training-delivered';
import {
  counted,
  waitingForTraining,
} from '../shared-render/waiting-for-training';

export type TrainedMachine = {
  id: string;
  name: string;
  openTickets: number;
  upcomingTrainings: number;
  // Not trained, and passed the quiz or said they would like training.
  waiting: number;
  // How long the longest of them has waited, from when.
  longestWaitingSince: O.Option<Date>;
  // Trainings on the machine in each of the last four quarters, oldest
  // first: whether training here is keeping up.
  trainingsByQuarter: ReadonlyArray<QuarterCount>;
};

export type OwnedArea = {
  id: string;
  name: string;
  // Absent when the area has not been put in a purchasing area yet.
  purchasingAreaId: O.Option<UUID>;
  // Not resolved yet, on any machine in the area or on the area itself.
  openTickets: number;
  // The machines in the area this owner also trains on, by name.
  trainerOn: ReadonlyArray<TrainedMachine>;
};

export type ViewModel = {
  isSuperUser: boolean;
  // By name.
  ownedAreas: ReadonlyArray<OwnedArea>;
  now: Date;
};

const byName = <T extends {name: string}>(a: T, b: T) =>
  a.name.localeCompare(b.name);

type Waiting = {count: number; longestSince: O.Option<Date>};

const noneWaiting: Waiting = {count: 0, longestSince: O.none};

// Who is waiting on each machine, by machine id.
const waitingOn = (
  deps: Dependencies,
  equipmentIds: ReadonlyArray<UUID>,
  now: Date
): TE.TaskEither<FailureWithStatus, ReadonlyMap<string, Waiting>> =>
  pipe(
    equipmentIds,
    RA.filterMap(id => deps.sharedReadModel.equipment.get(id)),
    TE.traverseArray(equipment =>
      pipe(
        waitingForTraining(deps, equipment, now),
        TE.map(counted),
        TE.map(
          waiting =>
            [
              equipment.id as string,
              {
                count: waiting.length,
                // Longest first.
                longestSince: O.fromNullable(waiting[0]?.waitingSince),
              },
            ] as const
        )
      )
    ),
    TE.map(entries => new Map(entries))
  );

export const constructViewModel = (
  deps: Dependencies,
  user: User,
  now: Date = new Date()
): TE.TaskEither<FailureWithStatus, ViewModel> => {
  const rm = deps.sharedReadModel;
  const member = rm.members.getByMemberNumber(user.memberNumber);
  if (O.isNone(member)) {
    return TE.right({isSuperUser: false, ownedAreas: [], now});
  }
  const trains = new Set(
    member.value.trainerFor.map(item => item.equipment_id as string)
  );
  const areas = [...member.value.ownerOf].sort(byName).map(area => ({
    area,
    machines: rm.equipment
      .getForAreaMinimal(area.id as UUID)
      .filter(
        equipment =>
          O.isNone(equipment.removedAt) && trains.has(equipment.id as string)
      )
      .sort(byName),
  }));
  const machineIds = areas.flatMap(({machines}) =>
    machines.map(machine => machine.id)
  );

  // A ticket is the area's when its machine is in the area, or when it was
  // raised against the area itself.
  const areaOfEquipment = new Map(
    rm.equipment
      .getAllMinimal()
      .map(item => [item.id as string, item.areaId as string])
  );
  const open = rm.troubleTickets
    .getAll()
    .filter(ticket => ticket.status !== 'Resolved');
  const openInArea = (areaId: string) =>
    open.filter(
      ticket =>
        (ticket.equipmentId === null
          ? ticket.areaId
          : areaOfEquipment.get(ticket.equipmentId)) === areaId
    ).length;
  const openOnMachine = (equipmentId: string) =>
    open.filter(ticket => ticket.equipmentId === equipmentId).length;

  const trainedAt = new Map<string, Date[]>();
  for (const row of rm.equipment.trainingsForEquipmentBuckets(machineIds)) {
    trainedAt.set(row.equipmentId, [
      ...(trainedAt.get(row.equipmentId) ?? []),
      row.trainedAt,
    ]);
  }

  return pipe(
    waitingOn(deps, machineIds, now),
    TE.map(waiting => ({
      isSuperUser: member.value.isSuperUser,
      now,
      ownedAreas: areas.map(({area, machines}) => ({
        id: area.id,
        name: area.name,
        purchasingAreaId: pipe(
          rm.purchasing.getForArea(area.id as UUID),
          O.map(purchasingArea => purchasingArea.id)
        ),
        openTickets: openInArea(area.id),
        trainerOn: machines.map(machine => {
          const onMachine = waiting.get(machine.id) ?? noneWaiting;
          return {
            id: machine.id,
            name: machine.name,
            openTickets: openOnMachine(machine.id),
            upcomingTrainings: rm.trainingSessions.upcomingForEquipment(
              machine.id,
              now
            ).length,
            waiting: onMachine.count,
            longestWaitingSince: onMachine.longestSince,
            trainingsByQuarter: trainingsByQuarter(
              trainedAt.get(machine.id) ?? [],
              DateTime.fromJSDate(now)
            ),
          };
        }),
      })),
    }))
  );
};
