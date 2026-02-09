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
import { TrainingMatrix } from '../shared-render/training-matrix';
import { Member } from '../../read-models/members';
import { EquipmentId } from '../../types/equipment-id';
import { FullQuizResultsForMember, getFullQuizResultsForMember } from '../../read-models/external-state/equipment-quiz';

export const constructTrainingMatrix = (
  member: Member,
  quizData: FullQuizResultsForMember
): O.Option<TrainingMatrix> => {
  const matrix: Record<EquipmentId, TrainingMatrix[0]> = {};

  for (const [equipmentId, attempts] of Object.entries(quizData.equipmentQuizAttempted)) {
    if (!matrix[equipmentId]) {
      matrix[equipmentId] = {
        
      };
    }

    matrix[equipmentId].
  }

  matrix.push({
    equipment_name: '',
    equipment_id: undefined,
    is_trainer: undefined,
    is_owner: undefined,
    is_trained: undefined,
    equipment_quiz_passed: undefined
  })

  return O.some(matrix);
}

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (memberNumber: number): TE.TaskEither<FailureWithStatus, ViewModel> => async () => {
    const userDetails = deps.sharedReadModel.members.get(user.memberNumber);
    if (O.isNone(userDetails)) {
      return E.left(failureWithStatus('No such member', StatusCodes.NOT_FOUND)());
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
      trainingMatrix: constructTrainingMatrix(memberScoped.value, quizData.right),
    });
  };

// Use the shared read model for getting member information
// Add redacting of this information
// Display the extra training information
