import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';
import {render} from './render';

// Every purchase request, those awaiting approval first. Any member may look;
// super users approve or decline them from each request's page.
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
      isSuperUser: pipe(
        viewer,
        O.exists(member => member.isSuperUser)
      ),
    }),
    toLoggedInContent(safe('Purchase requests')),
    TE.right
  );
};
