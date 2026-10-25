import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import {isEquipmentTrainer} from '../../commands/authentication-helpers/is-equipment-trainer';
import {
  TrainingSessionView,
  toTrainingSessionView,
} from '../shared-render/upcoming-training-sessions';

export type ViewModel = {
  equipment: {id: UUID; name: string};
  // Soonest first: the next one is what a trainer is most likely checking.
  upcoming: ReadonlyArray<TrainingSessionView>;
  // Most recent first: the last few are the ones worth copying.
  previous: ReadonlyArray<TrainingSessionView>;
  // The latest session the trainer reading the page arranged here, upcoming
  // or not: most trainers run the same session again and again.
  lastOwnSessionId: O.Option<UUID>;
};

export const constructViewModel =
  (deps: Dependencies, user: User, now: Date) =>
  (equipmentId: UUID): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.sharedReadModel.equipment.get(equipmentId),
      TE.fromOption(
        failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)
      ),
      TE.filterOrElse(
        equipment =>
          isEquipmentTrainer({
            actor: {tag: 'user', user},
            rm: deps.sharedReadModel,
            input: {equipmentId: equipment.id},
          }),
        () =>
          failureWithStatus(
            'Only trainers on this equipment can arrange its trainings',
            StatusCodes.FORBIDDEN
          )()
      ),
      TE.map(equipment => {
        // Latest first.
        const sessions = deps.sharedReadModel.trainingSessions.allForEquipment(
          equipment.id
        );
        const view = toTrainingSessionView(deps.sharedReadModel, equipment);
        return {
          equipment: {id: equipment.id, name: equipment.name},
          upcoming: sessions
            .filter(session => session.endsAt > now)
            .map(view)
            .reverse(),
          previous: sessions
            .filter(session => session.endsAt <= now)
            .map(view),
          lastOwnSessionId: pipe(
            sessions.find(
              session => session.trainerMemberNumber === user.memberNumber
            ),
            O.fromNullable,
            O.map(session => session.id)
          ),
        };
      })
    );
