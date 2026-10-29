import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../../dependencies';
import {
  getUpcomingMeetupTrainings,
  MeetupTraining,
} from '../../read-models/external-state/meetup-trainings';
import {matchMeetupTraining} from '../../training-sessions/meetup-match';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {html, Html, safe, sanitizeString} from '../../types/html';

export type MeetupTrainingView = MeetupTraining & {
  // The machine it is for, when that could be told.
  equipmentId: O.Option<string>;
};

// Every upcoming Meetup training, each with the machine it is for when that
// can be told. Only machines that have training, and are still in use, are
// candidates.
export const upcomingMeetupTrainings = (
  deps: Dependencies,
  now: Date
): TE.TaskEither<FailureWithStatus, ReadonlyArray<MeetupTrainingView>> =>
  pipe(
    TE.tryCatch(
      () => getUpcomingMeetupTrainings(deps.extDB)(now),
      error => {
        deps.logger.error(error, 'Failed to read Meetup trainings');
        return failureWithStatus(
          'Internal Error',
          StatusCodes.INTERNAL_SERVER_ERROR
        )();
      }
    ),
    TE.map(trainings => {
      const machines = deps.sharedReadModel.equipment
        .getAllMinimal()
        .filter(
          machine => machine.category === 'red' && O.isNone(machine.removedAt)
        );
      return trainings.map(training => ({
        ...training,
        equipmentId: matchMeetupTraining(training, machines),
      }));
    })
  );

export const forEquipment = (
  trainings: ReadonlyArray<MeetupTrainingView>,
  equipmentId: string
) =>
  trainings.filter(training =>
    O.exists(id => id === equipmentId)(training.equipmentId)
  );

// Meetup counts the host among those going, so the numbers are said as
// Meetup says them rather than turned into spaces left.
export const meetupNumbers = (training: MeetupTrainingView): Html =>
  training.rsvpsClosed
    ? html`RSVPs closed`
    : html`${safe(String(training.going))} going${training.maxTickets > 0
        ? html` · limit ${safe(String(training.maxTickets))}`
        : html``}`;

// A link rather than a button: booking happens on Meetup, and a page of
// identical buttons would shout louder than the trainings themselves.
export const bookOnMeetup = (training: MeetupTrainingView): Html => html`<a
  class="book-on-meetup"
  href="${sanitizeString(training.url)}"
  target="_blank"
  rel="noreferrer"
  >Book on Meetup ↗</a
>`;

export const onMeetupTag = html`<span class="tag tag--meetup">On Meetup</span>`;
