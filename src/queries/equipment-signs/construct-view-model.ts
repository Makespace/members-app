import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import {EquipmentCategory} from '../../types/equipment-category';

export type Sign = {
  id: string;
  name: string;
  areaName: string;
  category: EquipmentCategory;
  // The page a member reaches by scanning: what is already reported, and the
  // way to report something new.
  url: string;
};

export type ViewModel = {
  signs: ReadonlyArray<Sign>;
  // Areas to choose between when nothing is selected yet.
  areas: ReadonlyArray<{id: string; name: string; equipmentCount: number}>;
  selectedArea: O.Option<{id: string; name: string}>;
};

export const constructViewModel =
  (
    deps: Dependencies,
    params: {areaId?: string; equipmentId?: string}
  ) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> => {
    const rm = deps.sharedReadModel;
    return pipe(
      rm.members.getByMemberNumber(user.memberNumber),
      TE.fromOption(
        failureWithStatus('You are not logged in', StatusCodes.UNAUTHORIZED)
      ),
      TE.filterOrElse(
        member => member.isSuperUser || member.ownerOf.length > 0,
        () =>
          failureWithStatus(
            'Only owners and super-users can print equipment signs',
            StatusCodes.FORBIDDEN
          )()
      ),
      TE.map(() => {
        const areaNames = new Map(
          rm.area.getAllMinimal().map(area => [area.id as string, area.name])
        );
        const equipment = rm.equipment
          .getAllMinimal()
          // A retired machine should not get a new sign printed for it.
          .filter(item => O.isNone(item.removedAt))
          .map(item => ({
            id: item.id as string,
            name: item.name,
            areaId: item.areaId as string,
            areaName: areaNames.get(item.areaId as string) ?? '',
            category: item.category,
            url: `${deps.conf.PUBLIC_URL}/trouble-tickets?equipmentId=${item.id}`,
          }));

        const selected = pipe(
          O.fromNullable(params.areaId),
          O.chain(id =>
            pipe(
              O.fromNullable(areaNames.get(id)),
              O.map(name => ({id, name}))
            )
          )
        );

        // One machine, one area, or nothing yet - in which case the page
        // offers the areas to choose from rather than printing everything.
        const signs = params.equipmentId
          ? equipment.filter(item => item.id === params.equipmentId)
          : pipe(
              selected,
              O.match(
                () => [],
                area => equipment.filter(item => item.areaId === area.id)
              )
            );

        return {
          signs: [...signs].sort((a, b) => a.name.localeCompare(b.name)),
          areas: [...areaNames.entries()]
            .map(([id, name]) => ({
              id,
              name,
              equipmentCount: equipment.filter(item => item.areaId === id)
                .length,
            }))
            .filter(area => area.equipmentCount > 0)
            .sort((a, b) => a.name.localeCompare(b.name)),
          selectedArea: selected,
        };
      })
    );
  };
