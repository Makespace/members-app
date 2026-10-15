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

type UnassignAreaFromPurchasingArea = t.TypeOf<typeof codec>;

const process: Command<UnassignAreaFromPurchasingArea>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.chain(purchasingArea =>
      purchasingArea.areas.some(area => area.id === input.command.areaId)
        ? TE.right(
            O.some(
              constructEvent('AreaUnassignedFromPurchasingArea')(input.command)
            )
          )
        : TE.left(
            failureWithStatus(
              'The requested area is not part of the requested purchasing area',
              StatusCodes.BAD_REQUEST
            )()
          )
    )
  );

export const unassignArea: Command<UnassignAreaFromPurchasingArea> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
