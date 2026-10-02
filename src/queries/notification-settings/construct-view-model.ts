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
import {
  preferencesFor,
  soundingScopes,
} from '../../trouble-tickets/notification-preferences';
import {ViewModel} from './view-model';

// Everybody manages their own; there is nothing here to be privileged about.
export const constructViewModel =
  (
    deps: Pick<Dependencies, 'sharedReadModel'>,
    user: User
  ): TE.TaskEither<FailureWithStatus, ViewModel> =>
  async () => {
    const member = deps.sharedReadModel.members.getByMemberNumber(
      user.memberNumber
    );
    if (O.isNone(member)) {
      return E.left(
        failureWithStatus('No such member', StatusCodes.NOT_FOUND)()
      );
    }

    const scopes = preferencesFor(member.value);

    return E.right({
      scopes,
      soundingCount: soundingScopes(scopes).length,
      isOwner: member.value.ownerOf.length > 0,
      isTrainer: member.value.trainerFor.length > 0,
    });
  };
