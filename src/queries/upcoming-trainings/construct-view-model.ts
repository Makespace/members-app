import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import {
  toTrainingSessionView,
  TrainingSessionView,
} from '../shared-render/upcoming-training-sessions';

export type UpcomingTraining = {
  equipment: {id: string; name: string; areaName: string};
  session: TrainingSessionView;
};

export type ViewModel = {
  // Soonest first, on every machine.
  trainings: ReadonlyArray<UpcomingTraining>;
};

// Every training arranged in the app that is still to come. A machine since
// taken out of use has nothing left to train anybody on, so its sessions are
// left out rather than offered.
export const constructViewModel = (
  deps: Dependencies,
  user: User,
  now: Date
): ViewModel => ({
  trainings: deps.sharedReadModel.trainingSessions
    .allUpcoming(now)
    .flatMap(session =>
      pipe(
        deps.sharedReadModel.equipment.get(session.equipmentId),
        O.filter(equipment => O.isNone(equipment.removedAt)),
        O.match(
          () => [],
          equipment => [
            {
              equipment: {
                id: equipment.id,
                name: equipment.name,
                areaName: equipment.area.name,
              },
              session: toTrainingSessionView(
                deps.sharedReadModel,
                equipment,
                O.some({memberNumber: user.memberNumber, now})
              )(session),
            },
          ]
        )
      )
    ),
});
