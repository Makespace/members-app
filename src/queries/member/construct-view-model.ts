import {Dependencies} from '../../dependencies';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as RR from 'fp-ts/ReadonlyRecord';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {StatusCodes} from 'http-status-codes';
import { TrainingMatrix } from '../shared-render/training-matrix';
import { EquipmentId } from '../../types/equipment-id';
import { FullQuizResultsForMember, getFullQuizResultsForMember } from '../../read-models/external-state/equipment-quiz';
import { UUID } from 'io-ts-types';
import { Member } from '../../read-models/shared-state/return-types';
import { pipe } from 'fp-ts/lib/function';

const constructTrainingMatrix = (
  member: Member,
  deps: Dependencies,
  quizData: FullQuizResultsForMember
): TrainingMatrix => {
  const matrix: Record<EquipmentId, TrainingMatrix[0]> = {};

  for (const [equipmentId, equipment_quiz] of RR.toEntries(quizData.equipmentQuiz)) {
    const equipment = deps.sharedReadModel.equipment.get(equipmentId);
    if (O.isSome(equipment)) {
      matrix[equipmentId] = {
        equipment_id: equipmentId,
        equipment_name: equipment.value.name,
        equipment_quiz,
        is_owner: pipe(
          member.ownerOf,
          RA.findFirst(ownerOf => ownerOf.id === equipment.value.area.id),
          O.map(o => o.ownershipRecordedAt)
        ),
        is_trained: pipe(
          member.trainedOn,
          RA.findFirst(entry => entry.id === equipmentId),
          O.map(t => t.trainedAt)
        ),
        is_trainer: pipe(
          member.trainerFor,
          RA.findFirst(entry => entry.equipment_id === equipmentId),
          O.map(t => t.since)
        ),
      };
    }
  }

  return [
    {
      equipment_id: '12345678-12345678-4111-1234-12341234' as UUID,
      equipment_name: 'Metal Mill',
      equipment_quiz: {
        passedAt: [],
        attempted: [
          {
            response_submitted: new Date(),
            sheet_id: 'abc',
            score: 9,
            max_score: 10,
            percentage: 90
          }
        ]
      },
      is_owner: O.none,
      is_trained: O.none,
      is_trainer: O.none,
    },
    {
      equipment_id: '12345678-12345678-4111-1234-12341234' as UUID,
      equipment_name: 'Metal Lathe',
      equipment_quiz: {
        passedAt: [new Date()],
        attempted: [
          {
            response_submitted: new Date(),
            sheet_id: 'abc',
            score: 9,
            max_score: 10,
            percentage: 90
          }
        ]
      },
      is_owner: O.some(new Date()),
      is_trained: O.some(new Date()),
      is_trainer: O.some(new Date()),
    }
  ]
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
      trainingMatrix: constructTrainingMatrix(memberScoped.value, deps, quizData.right),
    });
  };

// Use the shared read model for getting member information
// Add redacting of this information
// Display the extra training information
