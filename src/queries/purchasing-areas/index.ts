import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';
import {budgetYearOf} from '../../purchasing/budget-year';
import {render} from './render';

// Every purchasing area with this year's budget figures. Any member may look;
// only super users change them, and purchasers (or super users) submit.
export const purchasingAreas: Query = deps => user => {
  const now = new Date();
  const member = deps.sharedReadModel.members.getByMemberNumber(
    user.memberNumber
  );
  const isSuperUser = pipe(
    member,
    O.exists(m => m.isSuperUser)
  );
  const canRequest =
    isSuperUser ||
    pipe(
      member,
      O.exists(
        m => deps.sharedReadModel.purchasing.getForPurchaser(m.userId, now).length > 0
      )
    );
  return pipe(
    render({
      budgetYear: budgetYearOf(now),
      purchasingAreas: deps.sharedReadModel.purchasing.getAll(now),
      canManage: isSuperUser,
      canRequest,
    }),
    toLoggedInContent(safe('Purchasing areas')),
    TE.right
  );
};
