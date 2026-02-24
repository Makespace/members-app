import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {ViewModel} from './view-model';
import {User} from '../../types';
import {UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {
  FullQuizResultsForEquipment,
  getFullQuizResultsForEquipment,
} from '../../read-models/external-state/equipment-quiz';

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: UUID): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      {user},
      TE.right,
      TE.bind('equipment', () => {
        const equipment = deps.sharedReadModel.equipment.get(equipmentId);
        if (O.isNone(equipment)) {
          return TE.left(
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)()
          );
        }
        return TE.right(equipment.value);
      }),
      TE.let('member', () =>
        deps.sharedReadModel.members.get(user.memberNumber)
      ),
      TE.let('isSuperUser', ({member}) =>
        O.isNone(member) ? false : member.value.isSuperUser
      ),
      TE.let('isOwner', ({equipment, member}) =>
        O.isNone(member)
          ? false
          : member.value.ownerOf.findIndex(
              ownerOf => ownerOf.id === equipment.area.id
            ) !== -1
      ),
      TE.let(
        'isTrainer',
        ({equipment}) =>
          equipment.trainers.findIndex(
            trainer => trainer.memberNumber === user.memberNumber
          ) !== -1
      ),
      TE.let(
        'isSuperUserOrOwnerOfArea',
        ({isSuperUser, isOwner}) => isSuperUser || isOwner
      ),
      TE.let(
        'isSuperUserOrTrainerOfArea',
        ({isSuperUser, isTrainer}) => isSuperUser || isTrainer
      ),
      TE.bind('quizResults', ({equipment}) => {
        if (O.isNone(equipment.trainingSheetId)) {
          return TE.right(O.none);
        }
        return pipe(
          getFullQuizResultsForEquipment(deps, equipment.trainingSheetId.value, equipment),
          TE.map<FullQuizResultsForEquipment, O.Option<FullQuizResultsForEquipment>>(O.some),
          TE.mapLeft(err_str => {
            deps.logger.error(
              'Failed to read sheet sync metadata: %s',
              err_str
            );
            return failureWithStatus(
              'Internal Error',
              StatusCodes.INTERNAL_SERVER_ERROR
            )();
          })
        );
      })
    );
