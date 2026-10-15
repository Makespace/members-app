import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {getPurchasingAreaOrFail} from './helpers';

const codec = t.strict({
  purchasingAreaId: tt.UUID,
  memberNumber: tt.NumberFromString,
});

type AddPurchaser = t.TypeOf<typeof codec>;

const process: Command<AddPurchaser>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.chain(purchasingArea =>
      pipe(
        input.rm.members.getByMemberNumber(input.command.memberNumber),
        TE.fromOption(() =>
          failureWithStatus(
            'The requested member does not exist',
            StatusCodes.NOT_FOUND
          )()
        ),
        TE.map(member => ({purchasingArea, member}))
      )
    ),
    TE.chain(({purchasingArea, member}) => {
      if (
        purchasingArea.purchasers.some(purchaser =>
          allMemberNumbers(purchaser).includes(input.command.memberNumber)
        )
      ) {
        return TE.right(O.none);
      }
      // Product assumption (not yet confirmed): only someone who currently
      // owns at least one of the purchasing area's areas may purchase for it.
      // Drop this check if purchasers turn out to be chosen more widely.
      const areaIds = purchasingArea.areas.map(area => area.id);
      const ownsAnArea = member.ownerOf.some(owned =>
        areaIds.includes(owned.id as tt.UUID)
      );
      if (!ownsAnArea) {
        return TE.left(
          failureWithStatus(
            `A purchaser must be an owner of at least one area in '${purchasingArea.name}'. Make them an owner first.`,
            StatusCodes.BAD_REQUEST
          )()
        );
      }
      return TE.right(O.some(constructEvent('PurchaserAdded')(input.command)));
    })
  );

export const addPurchaser: Command<AddPurchaser> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
