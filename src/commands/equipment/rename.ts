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

// Surrounding whitespace is never meant, and a name of nothing but whitespace
// is not a name.
const trimmedNonEmpty = new t.Type<string, string, unknown>(
  'trimmedNonEmpty',
  (u): u is string => typeof u === 'string' && u.trim() !== '',
  (u, c) =>
    typeof u === 'string' && u.trim() !== ''
      ? t.success(u.trim())
      : t.failure(u, c),
  t.identity
);

const codec = t.strict({
  equipmentId: tt.UUID,
  name: trimmedNonEmpty,
});

type RenameEquipment = t.TypeOf<typeof codec>;

// Rename a machine. No-op when the name is unchanged, so saving the form
// without editing anything records nothing.
const process: Command<RenameEquipment>['process'] = input =>
  pipe(
    input.rm.equipment.get(input.command.equipmentId),
    TE.fromOption(() =>
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
    ),
    TE.map(equipment =>
      equipment.name === input.command.name
        ? O.none
        : O.some(
            constructEvent('EquipmentNameChanged')({
              equipmentId: input.command.equipmentId,
              name: input.command.name,
              // Carried on the event so the read model can keep it working as
              // an alias, and so the log says what it was called before.
              previousName: equipment.name,
              actor: input.command.actor,
            })
          )
    )
  );

export const rename: Command<RenameEquipment> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
