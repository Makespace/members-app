import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import {Equipment} from '../../read-models/shared-state/return-types';
import {FailureWithStatus} from '../../types/failure-with-status';
import {
  toTrainingSessionView,
  TrainingSessionView,
} from '../shared-render/upcoming-training-sessions';
import {
  MeetupTrainingView,
  upcomingMeetupTrainings,
} from '../shared-render/meetup-trainings';
import {
  readinessFor,
  Readiness,
  trainedSinceFor,
} from '../equipment-training/construct-view-model';

type Machine = {id: string; name: string; areaName: string};

// Where the reader stands with a machine. Somebody not logged in is neither
// trained nor held back by anything the app knows about.
type Standing = {
  // Already trained on the machine: they may still come for a refresher.
  trained: boolean;
  // Whether anything comes first - other machines, or the quiz. When it
  // does, they are sent to the machine's training page rather than straight
  // to a session.
  readiness: Readiness;
};

export type UpcomingTraining = Standing & {
  equipment: Machine;
  session: TrainingSessionView;
};

export type UpcomingMeetupTraining = Standing & {
  // Absent when the title and description did not say which machine.
  equipment: O.Option<Machine>;
  meetup: MeetupTrainingView;
};

export type ViewModel = {
  loggedIn: boolean;
  // Soonest first, on every machine.
  trainings: ReadonlyArray<UpcomingTraining>;
  meetupTrainings: ReadonlyArray<UpcomingMeetupTraining>;
  showingTrained: boolean;
  // How many machines' sessions were left out because the reader is
  // trained on them, when they are being left out.
  hiddenEquipment: number;
};

const machineOf = (equipment: Equipment): Machine => ({
  id: equipment.id,
  name: equipment.name,
  areaName: equipment.area.name,
});

const standingOn =
  (deps: Dependencies, user: O.Option<User>) =>
  (equipment: Equipment): Standing =>
    pipe(
      user,
      O.match(
        () => ({trained: false, readiness: {tag: 'ready'} as Readiness}),
        user => ({
          trained: O.isSome(trainedSinceFor(deps, user, equipment.id)),
          readiness: readinessFor(deps, user, equipment),
        })
      )
    );

// A machine since taken out of use has nothing left to train anybody on.
const inUse = (deps: Dependencies, equipmentId: string) =>
  pipe(
    deps.sharedReadModel.equipment.get(equipmentId as Equipment['id']),
    O.filter(equipment => O.isNone(equipment.removedAt))
  );

// Every training still to come - arranged in the app, or on Meetup - so a
// member can find one without knowing which machine to look on. By default
// the machines the reader is already trained on are left out: they are mostly
// looking for something new.
export const constructViewModel = (
  deps: Dependencies,
  user: O.Option<User>,
  now: Date,
  showTrained: boolean
): TE.TaskEither<FailureWithStatus, ViewModel> =>
  pipe(
    upcomingMeetupTrainings(deps, now),
    TE.map(meetupTrainings => {
      const standing = standingOn(deps, user);
      const viewer = pipe(
        user,
        O.map(user => ({memberNumber: user.memberNumber, now}))
      );
      const app: ReadonlyArray<UpcomingTraining> =
        deps.sharedReadModel.trainingSessions
          .allUpcoming(now)
          .flatMap(session =>
            pipe(
              inUse(deps, session.equipmentId),
              O.match(
                () => [],
                equipment => [
                  {
                    equipment: machineOf(equipment),
                    session: toTrainingSessionView(
                      deps.sharedReadModel,
                      equipment,
                      viewer
                    )(session),
                    ...standing(equipment),
                  },
                ]
              )
            )
          );
      const meetup: ReadonlyArray<UpcomingMeetupTraining> =
        meetupTrainings.map(training =>
          pipe(
            training.equipmentId,
            O.chain(id => inUse(deps, id)),
            O.match(
              () => ({
                equipment: O.none,
                meetup: training,
                trained: false,
                readiness: {tag: 'ready'} as Readiness,
              }),
              equipment => ({
                equipment: O.some(machineOf(equipment)),
                meetup: training,
                ...standing(equipment),
              })
            )
          )
        );
      const hidden = new Set([
        ...app.filter(t => t.trained).map(t => t.equipment.id),
        ...meetup.flatMap(t =>
          t.trained && O.isSome(t.equipment) ? [t.equipment.value.id] : []
        ),
      ]);
      return {
        loggedIn: O.isSome(user),
        trainings: showTrained ? app : app.filter(t => !t.trained),
        meetupTrainings: showTrained ? meetup : meetup.filter(t => !t.trained),
        showingTrained: showTrained,
        hiddenEquipment: showTrained ? 0 : hidden.size,
      };
    })
  );
