import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {Dependencies} from '../../dependencies';
import {User} from '../../types';

export type TrainedMachine = {
  id: string;
  name: string;
  openTickets: number;
  upcomingTrainings: number;
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
};

const byName = <T extends {name: string}>(a: T, b: T) =>
  a.name.localeCompare(b.name);

export const constructViewModel = (
  deps: Dependencies,
  user: User,
  now: Date = new Date()
): ViewModel => {
  const rm = deps.sharedReadModel;
  return pipe(
    rm.members.getByMemberNumber(user.memberNumber),
    O.match(
      () => ({isSuperUser: false, ownedAreas: []}),
      member => {
        const trains = new Set(
          member.trainerFor.map(item => item.equipment_id as string)
        );
        // A ticket is the area's when its machine is in the area, or when it
        // was raised against the area itself.
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
        return {
          isSuperUser: member.isSuperUser,
          ownedAreas: [...member.ownerOf].sort(byName).map(area => ({
            id: area.id,
            name: area.name,
            purchasingAreaId: pipe(
              rm.purchasing.getForArea(area.id as UUID),
              O.map(purchasingArea => purchasingArea.id)
            ),
            openTickets: openInArea(area.id),
            trainerOn: rm.equipment
              .getForAreaMinimal(area.id as UUID)
              .filter(
                equipment =>
                  O.isNone(equipment.removedAt) &&
                  trains.has(equipment.id as string)
              )
              .map(equipment => ({
                id: equipment.id,
                name: equipment.name,
                openTickets: openOnMachine(equipment.id),
                upcomingTrainings: rm.trainingSessions.upcomingForEquipment(
                  equipment.id,
                  now
                ).length,
              }))
              .sort(byName),
          })),
        };
      }
    )
  );
};
