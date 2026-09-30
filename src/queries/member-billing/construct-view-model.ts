import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../../dependencies';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {mustBeSuperuser} from '../util';
import {getBillingForMember} from '../../read-models/external-state/recurly-billing';
import {ViewModel} from './view-model';

// A member's whole billing history. Super users only, checked before anything
// is read: the same bar as the summary on their page, which is the only place
// that links here.
export const constructViewModel =
  (deps: Pick<Dependencies, 'sharedReadModel' | 'extDB'>, user: User) =>
  (memberNumber: number): TE.TaskEither<FailureWithStatus, ViewModel> =>
  async () => {
    const superUserCheck = await mustBeSuperuser(deps.sharedReadModel, user)();
    if (E.isLeft(superUserCheck)) {
      return superUserCheck;
    }

    const member = deps.sharedReadModel.members.getAsActor(user)(memberNumber);
    if (O.isNone(member)) {
      return E.left(failureWithStatus('No such member', StatusCodes.NOT_FOUND)());
    }

    return E.right({
      memberNumber,
      memberName: O.getOrElse(() => `Member ${memberNumber}`)(
        member.value.name
      ),
      billing: await getBillingForMember(deps.extDB)(member.value),
    });
  };
