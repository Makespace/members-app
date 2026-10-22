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
import {getPurchasingAreaOrFail} from './helpers';

const codec = t.strict({
  purchasingAreaId: tt.UUID,
  areaId: tt.UUID,
});

type AssignAreaToPurchasingArea = t.TypeOf<typeof codec>;

// An area belongs to at most one purchasing area. Moving one is two steps -
// take it out of the old purchasing area first - so it is never moved by
// accident.
const process: Command<AssignAreaToPurchasingArea>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.chain(purchasingArea =>
      pipe(
        input.rm.area.get(input.command.areaId),
        TE.fromOption(() =>
          failureWithStatus(
            'The requested area does not exist',
            StatusCodes.NOT_FOUND
          )()
        ),
        TE.map(() => purchasingArea)
      )
    ),
    TE.chain(purchasingArea => {
      const current = input.rm.purchasing.getForArea(input.command.areaId);
      if (O.isNone(current)) {
        return TE.right(
          O.some(constructEvent('AreaAssignedToPurchasingArea')(input.command))
        );
      }
      if (current.value.id === purchasingArea.id) {
        return TE.right(O.none);
      }
      return TE.left(
        failureWithStatus(
          `That area already belongs to the purchasing area '${current.value.name}'. Remove it from there first.`,
          StatusCodes.BAD_REQUEST
        )()
      );
    })
  );

export const assignArea: Command<AssignAreaToPurchasingArea> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
