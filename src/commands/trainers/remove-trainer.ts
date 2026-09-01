import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../../types/failure-with-status';
import {isAdminSuperUserOrOwnerForEquipment} from '../authentication-helpers/is-admin-or-super-user-or-owner';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';

const codec = t.strict({
  equipmentId: tt.UUID,
  memberNumber: tt.NumberFromString,
});

export type RemoveTrainer = t.TypeOf<typeof codec>;

const process: Command<RemoveTrainer>['process'] = input =>
  pipe(
    input.rm.equipment.get(input.command.equipmentId),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested equipment does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    TE.chain(equipment =>
      equipment.trainers.some(trainer =>
        allMemberNumbers(trainer).includes(input.command.memberNumber)
      )
        ? TE.right(O.some(constructEvent('TrainerRemoved')(input.command)))
        : TE.left(
            failureWithStatus(
              'The requested member is not a trainer for the requested equipment',
              StatusCodes.BAD_REQUEST
            )()
          )
    )
  );

export const removeTrainer: Command<RemoveTrainer> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrOwnerForEquipment,
};
