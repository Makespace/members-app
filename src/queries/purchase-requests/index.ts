import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';
import {render} from './render';
import {
  buyerRoleFor,
  canDecide,
  canRequestFor,
} from '../../purchasing/permissions';
import {liftActorOrUser} from '../../read-models/lift-actor-or-user';

// Every purchase request, those awaiting approval first. Any member may look;
// purchasers and super users approve or decline them from each request's
// page (see src/purchasing/permissions.ts).
export const purchaseRequests: Query = deps => user => {
  const rm = deps.sharedReadModel;
  const viewer = rm.members.getByMemberNumber(user.memberNumber);
  const areaNames = new Map(
    rm.purchasing.getAll(new Date()).map(area => [area.id, area.name])
  );
  const requests = rm.purchasing.getAllRequests().map(request => ({
    request,
    areaName: O.fromNullable(areaNames.get(request.purchasingAreaId)),
    submitter: rm.members.getByMemberNumber(request.submittedByMemberNumber),
  }));
  return pipe(
    render({
      requests,
      canSeePrivateDetails: pipe(
        viewer,
        O.exists(member => member.isSuperUser || member.ownerOf.length > 0)
      ),
      // To approve or decline, and approved ones to buy.
      waitingForViewer: requests.filter(
        ({request}) =>
          (request.status === 'awaiting-approval' ||
            request.status === 'approved') &&
          canDecide(rm, liftActorOrUser(user), request)
      ),
      canRequest: rm.purchasing
        .getAll(new Date())
        .some(purchasingArea =>
          canRequestFor(rm, liftActorOrUser(user), purchasingArea)
        ),
      canBuyDirectly: rm.purchasing
        .getAll(new Date())
        .some(
          purchasingArea =>
            buyerRoleFor(rm, liftActorOrUser(user), purchasingArea) !== 'neither'
        ),
    }),
    toLoggedInContent(safe('Purchase requests')),
    TE.right
  );
};
