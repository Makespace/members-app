import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {Dependencies} from '../../dependencies';
import {User} from '../../types';

export type OwnedArea = {
  id: string;
  name: string;
  // Absent when the area has not been put in a purchasing area yet.
  purchasingAreaId: O.Option<UUID>;
  // The machines in the area this owner also trains on, by name.
  trainerOn: ReadonlyArray<{id: string; name: string}>;
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
  user: User
): ViewModel =>
  pipe(
    deps.sharedReadModel.members.getByMemberNumber(user.memberNumber),
    O.match(
      () => ({isSuperUser: false, ownedAreas: []}),
      member => {
        const trains = new Set(
          member.trainerFor.map(item => item.equipment_id as string)
        );
        return {
          isSuperUser: member.isSuperUser,
          ownedAreas: [...member.ownerOf].sort(byName).map(area => ({
            id: area.id,
            name: area.name,
            purchasingAreaId: pipe(
              deps.sharedReadModel.purchasing.getForArea(area.id as UUID),
              O.map(purchasingArea => purchasingArea.id)
            ),
            trainerOn: deps.sharedReadModel.equipment
              .getForAreaMinimal(area.id as UUID)
              .filter(
                equipment =>
                  O.isNone(equipment.removedAt) &&
                  trains.has(equipment.id as string)
              )
              .map(equipment => ({id: equipment.id, name: equipment.name}))
              .sort(byName),
          })),
        };
      }
    )
  );
