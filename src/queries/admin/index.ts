import {pipe} from 'fp-ts/lib/function';
import {Query} from '../query';
import {toLoggedInContent, safe} from '../../types/html';
import {Dependencies} from '../../dependencies';
import * as O from 'fp-ts/Option';
import {User} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';

const isSuperUser =
  (sharedReadModel: Dependencies['sharedReadModel']) => (user: User) =>
    pipe(
      user.memberNumber,
      sharedReadModel.members.get,
      O.filter(member => member.isSuperUser),
      O.getOrElseW(() => false)
    );

export const admin: Query = deps => user => {
  if (!isSuperUser(deps.sharedReadModel)(user)) {
    return TE.left(
      failureWithStatus(
        'You are not authorised to see this page',
        StatusCodes.FORBIDDEN
      )()
    );
  }
  return pipe(render(), toLoggedInContent(safe('Admin')), TE.right);
};
