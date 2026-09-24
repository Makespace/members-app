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
import {sizeFrom} from './render';
import {equipmentSlug, toSlug} from '../../templates/slug';

export type Sign = {
  id: string;
  name: string;
  areaName: string;
  category: EquipmentCategory;
  // The page a member reaches by scanning: what is already reported, and the
  // way to report something new.
  url: string;
  // The equipment guide, as recorded against the machine. None when nobody
  // has set one: the sign prints no learn code rather than a guessed address
  // that may not exist.
  learnUrl: O.Option<string>;
  // This machine's page in the app, listing who can train you. Only red
  // equipment needs training, so only red equipment carries this code.
  trainUrl: O.Option<string>;
  // Where to send a question about orange equipment, which has no training
  // to point at and no trainers to ask.
  areaEmail: O.Option<string>;
};

export type ViewModel = {
  signs: ReadonlyArray<Sign>;
  // Machines in this selection with no guide address recorded, so whoever is
  // about to print notices before the posters are on the wall rather than
  // after.
  missingGuideUrl: ReadonlyArray<string>;
  // Paper size to lay the signs out for.
  size: 'a7' | 'a6' | 'a5' | 'a4';
  // Areas to choose between when nothing is selected yet.
  areas: ReadonlyArray<{id: string; name: string; equipmentCount: number}>;
  selectedArea: O.Option<{id: string; name: string}>;
};

export const constructViewModel =
  (
    deps: Dependencies,
    params: {areaId?: string; equipmentId?: string; size?: string}
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
        const areas = new Map(
          rm.area.getAllMinimal().map(area => [area.id as string, area])
        );
        const areaNames = new Map(
          [...areas.entries()].map(([id, area]) => [id, area.name])
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
            url: `${deps.conf.PUBLIC_URL}/trouble-tickets?equipmentId=${equipmentSlug(
              areaNames.get(item.areaId as string) ?? '',
              item.name
            )}`,
            learnUrl: item.guideUrl,
            trainUrl:
              item.category === 'red'
                ? O.some(
                    `${deps.conf.PUBLIC_URL}/equipment/${equipmentSlug(
                      areaNames.get(item.areaId as string) ?? '',
                      item.name
                    )}/training`
                  )
                : O.none,
            areaEmail: pipe(
              O.fromNullable(areas.get(item.areaId as string)),
              O.chain(area => area.email),
              O.map(email => email as string)
            ),
          }));

        const selected = pipe(
          O.fromNullable(params.areaId),
          O.chain(reference =>
            pipe(
              [...areaNames.entries()].find(
                ([id, name]) =>
                  id === reference || toSlug(name) === reference.toLowerCase()
              ),
              O.fromNullable,
              O.map(([id, name]) => ({id, name}))
            )
          )
        );

        // One machine, one area, or nothing yet - in which case the page
        // offers the areas to choose from rather than printing everything.
        const wanted = params.equipmentId?.toLowerCase();
        const signs = wanted
          ? equipment.filter(
              item =>
                item.id === params.equipmentId ||
                equipmentSlug(item.areaName, item.name) === wanted
            )
          : pipe(
              selected,
              O.match(
                () => [],
                area => equipment.filter(item => item.areaId === area.id)
              )
            );

        const ordered = [...signs].sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        return {
          size: sizeFrom(params.size),
          signs: ordered,
          missingGuideUrl: ordered
            .filter(sign => O.isNone(sign.learnUrl))
            .map(sign => sign.name),
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
