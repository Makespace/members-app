import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {DisplayNumberCodec} from '../../eink/display-number';

const codec = t.strict({
  displayNumber: DisplayNumberCodec,
  equipmentId: tt.UUID,
});

type AssignEinkDisplay = t.TypeOf<typeof codec>;

// Points a display at a machine's trouble tickets. Pointing it where it
// already points is nothing to record.
const process: Command<AssignEinkDisplay>['process'] = input =>
  pipe(
    input.rm.equipment.get(input.command.equipmentId),
    TE.fromOption(failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)),
    TE.map(() =>
      pipe(
        input.rm.einkDisplays.get(input.command.displayNumber),
        O.exists(current => current === input.command.equipmentId)
      )
        ? O.none
        : O.some(constructEvent('EinkDisplayAssigned')(input.command))
    )
  );

export const assign: Command<AssignEinkDisplay> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
