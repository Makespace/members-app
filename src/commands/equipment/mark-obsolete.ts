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

const codec = t.strict({
  id: tt.UUID,
});

type MarkEquipmentObsolete = t.TypeOf<typeof codec>;

const process: Command<MarkEquipmentObsolete>['process'] = input =>
  pipe(
    input.rm.equipment.get(input.command.id),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested equipment does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    // Idempotent: if it is already obsolete, there is nothing to record.
    TE.map(equipment =>
      O.isSome(equipment.removedAt)
        ? O.none
        : O.some(constructEvent('EquipmentMarkedObsolete')(input.command))
    )
  );

export const markEquipmentObsolete: Command<MarkEquipmentObsolete> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
