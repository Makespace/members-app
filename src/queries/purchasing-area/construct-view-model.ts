import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  Member,
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
  // This budget year's requests, newest first, each with who sent it (none
  // if their member record can't be found).
  requests: ReadonlyArray<{
    request: PurchaseRequest;
    submitter: O.Option<Member>;
  }>;
  canManage: boolean;
  // Email addresses are shown, as on the areas page, to super users and
  // area owners only.
  canSeePrivateDetails: boolean;
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
        const viewer = rm.members.getByMemberNumber(user.memberNumber);
        const isSuperUser = pipe(
          viewer,
          O.exists(member => member.isSuperUser)
        );
        const isOwnerOfAnyArea = pipe(
          viewer,
          O.exists(member => member.ownerOf.length > 0)
        );
        return {
          purchasingArea,
          requests: rm.purchasing
            .getRequests(purchasingArea.id, purchasingArea.budgetYear)
            .map(request => ({
              request,
              submitter: rm.members.getByMemberNumber(
                request.submittedByMemberNumber
              ),
            })),
          canManage: isSuperUser,
          canSeePrivateDetails: isSuperUser || isOwnerOfAnyArea,
        };
      })
    );
