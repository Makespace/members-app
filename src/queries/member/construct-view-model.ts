import {Dependencies} from '../../dependencies';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {StatusCodes} from 'http-status-codes';
import { getFullQuizResultsForMember } from '../../read-models/external-state/equipment-quiz';
import { constructTrainingMatrix } from '../training-matrix/construct-view-model';
import { getRecurlyStatusForMember } from '../../read-models/external-state/recurly-status';

export const constructViewModel =
  (
    deps: Pick<Dependencies, 'sharedReadModel' | 'getSheetDataByMemberNumber' | 'extDB'>,
    user: User
  ) =>
  (memberNumber: number): TE.TaskEither<FailureWithStatus, ViewModel> => async () => {
    const userDetails = deps.sharedReadModel.members.getByMemberNumber(user.memberNumber);
    if (O.isNone(userDetails)) {
      return E.left(failureWithStatus('No such user', StatusCodes.NOT_FOUND)());
    }

    const memberScoped = deps.sharedReadModel.members.getAsActor(user)(memberNumber);
    if (O.isNone(memberScoped)) {
      return E.left(failureWithStatus('No such member', StatusCodes.NOT_FOUND)());
    }

    const quizData = O.isSome(memberScoped) ? await getFullQuizResultsForMember(deps, memberNumber)() : E.left('Unknown member - not getting sheet data');
    if (E.isLeft(quizData)) {
      return E.left(failureWithStatus('Failed to get training status', StatusCodes.INTERNAL_SERVER_ERROR)());
    }

    return E.right({
      user,
      isSelf: memberNumber === user.memberNumber,
      member: memberScoped.value,
      isSuperUser: O.isSome(userDetails) && userDetails.value.isSuperUser,
      trainingMatrix: constructTrainingMatrix(memberScoped.value, deps.sharedReadModel, quizData.right),
      recurlyStatus: await getRecurlyStatusForMember(deps.extDB)(memberScoped.value),
    });
  };

// Use the shared read model for getting member information
// Add redacting of this information
// Display the extra training information
