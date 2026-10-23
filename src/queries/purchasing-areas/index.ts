import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';
import {budgetYearOf} from '../../purchasing/budget-year';
import {render} from './render';
import {buyerRoleFor, canRequestFor} from '../../purchasing/permissions';
import {liftActorOrUser} from '../../read-models/lift-actor-or-user';

// Every purchasing area with this year's budget figures. Any member may look;
// only super users change them, and owners, purchasers and super users
// request purchases.
export const purchasingAreas: Query = deps => user => {
  const now = new Date();
  const member = deps.sharedReadModel.members.getByMemberNumber(
    user.memberNumber
  );
  const isSuperUser = pipe(
    member,
    O.exists(m => m.isSuperUser)
  );
  const purchasingAreas = deps.sharedReadModel.purchasing.getAll(now);
  return pipe(
    render({
      budgetYear: budgetYearOf(now),
      purchasingAreas,
      canManage: isSuperUser,
      canRequest: purchasingAreas.some(purchasingArea =>
        canRequestFor(deps.sharedReadModel, liftActorOrUser(user), purchasingArea)
      ),
      canBuyDirectly: purchasingAreas.some(
        purchasingArea =>
          buyerRoleFor(deps.sharedReadModel, liftActorOrUser(user), purchasingArea) !==
          'neither'
      ),
    }),
    toLoggedInContent(safe('Purchasing areas')),
    TE.right
  );
};
