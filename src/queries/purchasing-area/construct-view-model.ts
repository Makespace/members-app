import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  allMemberNumbers,
  PurchaseRequest,
  PurchasingArea,
} from '../../read-models/shared-state/return-types';
import {User} from '../../types';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';

export type ViewModel = {
  purchasingArea: PurchasingArea;
  // This budget year's requests, newest first.
  requests: ReadonlyArray<PurchaseRequest>;
  canManage: boolean;
  canRequest: boolean;
};

export const constructViewModel =
  (rm: SharedReadModel, user: User, now: Date) =>
  (idParam: unknown): E.Either<FailureWithStatus, ViewModel> =>
    pipe(
      idParam,
      UUID.decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Invalid purchasing area', StatusCodes.BAD_REQUEST)
      ),
      E.chain(id =>
        pipe(
          rm.purchasing.get(id, now),
          E.fromOption(() =>
            failureWithStatus(
              'No such purchasing area',
              StatusCodes.NOT_FOUND
            )()
          )
        )
      ),
      E.map(purchasingArea => {
        const isSuperUser = pipe(
          rm.members.getByMemberNumber(user.memberNumber),
          O.exists(member => member.isSuperUser)
        );
        const isPurchaser = purchasingArea.purchasers.some(purchaser =>
          allMemberNumbers(purchaser).includes(user.memberNumber)
        );
        return {
          purchasingArea,
          requests: rm.purchasing.getRequests(
            purchasingArea.id,
            purchasingArea.budgetYear
          ),
          canManage: isSuperUser,
          canRequest: isSuperUser || isPurchaser,
        };
      })
    );
