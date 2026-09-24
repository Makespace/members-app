import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {isAreaOwner} from '../authentication-helpers/is-area-owner';

// A link printed on a sign and followed by members, so it has to be a real
// web address; an empty value clears it.
const guideUrl = new t.Type<string, unknown, unknown>(
  'guideUrl',
  (u): u is string => typeof u === 'string',
  (u, context) => {
    if (typeof u !== 'string') {
      return t.failure(u, context, 'not a url');
    }
    const trimmed = u.trim();
    if (trimmed === '') {
      return t.success('');
    }
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        ? t.success(parsed.toString())
        : t.failure(u, context, 'not an http url');
    } catch {
      return t.failure(u, context, 'not a url');
    }
  },
  t.identity
);

const codec = t.strict({
  equipmentId: tt.UUID,
  url: guideUrl,
});

type SetEquipmentGuideUrl = t.TypeOf<typeof codec>;

const process: Command<SetEquipmentGuideUrl>['process'] = input =>
  pipe(
    input.rm.equipment.get(input.command.equipmentId),
    TE.fromOption(() =>
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
    ),
    TE.map(equipment =>
      O.getOrElse(() => '')(equipment.guideUrl) === input.command.url
        ? O.none
        : O.some(
            constructEvent('EquipmentGuideUrlSet')({
              equipmentId: input.command.equipmentId,
              url: input.command.url,
              actor: input.command.actor,
            })
          )
    )
  );

// Recording where to read about a machine is inventory work, like naming its
// units: the area's own owners can do it, as can admins.
export const setGuideUrl: Command<SetEquipmentGuideUrl> = {
  process,
  decode: codec.decode,
  isAuthorized: input =>
    isAdminOrSuperUser(input) ||
    pipe(
      input.rm.equipment.get(input.input.equipmentId),
      O.match(
        () => false,
        equipment =>
          isAreaOwner({
            actor: input.actor,
            rm: input.rm,
            input: {areaId: equipment.area.id},
          })
      )
    ),
};
