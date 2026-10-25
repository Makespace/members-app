import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {UUID} from 'io-ts-types';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  allMemberNumbers,
  Equipment,
} from '../../read-models/shared-state/return-types';
import {TrainingSession} from '../../read-models/shared-state/training-sessions/get';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {markdownToHtml} from '../../templates/markdown';

export type TrainingSessionView = {
  id: UUID;
  startsAt: Date;
  endsAt: Date;
  trainer: {memberNumber: number; name: O.Option<string>};
  spaces: number;
  booked: number;
  description: string;
};

// A trainer who has since been removed from the machine keeps the sessions
// they arranged, so their name comes from the member list when it is not on
// the machine's.
const trainerName = (
  rm: SharedReadModel,
  equipment: Equipment,
  memberNumber: number
): O.Option<string> =>
  pipe(
    equipment.trainers.find(trainer =>
      allMemberNumbers(trainer).includes(memberNumber)
    ),
    O.fromNullable,
    O.chain(trainer => trainer.name),
    O.alt(() =>
      pipe(
        rm.members.getByMemberNumber(memberNumber),
        O.chain(member => member.name)
      )
    )
  );

export const toTrainingSessionView =
  (rm: SharedReadModel, equipment: Equipment) =>
  (session: TrainingSession): TrainingSessionView => ({
    id: session.id,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    trainer: {
      memberNumber: session.trainerMemberNumber,
      name: trainerName(rm, equipment, session.trainerMemberNumber),
    },
    spaces: session.spaces,
    booked: session.attendees.length,
    description: session.description,
  });

export const upcomingTrainingSessions = (
  rm: SharedReadModel,
  equipment: Equipment,
  now: Date
): ReadonlyArray<TrainingSessionView> =>
  rm.trainingSessions
    .upcomingForEquipment(equipment.id, now)
    .map(toTrainingSessionView(rm, equipment));

const london = (date: Date) =>
  DateTime.fromJSDate(date).setZone('Europe/London').setLocale('en-GB');

// "Sat 7 Nov, 18:00–20:00": the day and the clock times are what people plan
// around, and the year only gets in the way for something weeks away.
const when = (session: TrainingSessionView) =>
  safe(
    `${london(session.startsAt).toFormat('ccc d LLL, HH:mm')}–${london(
      session.endsAt
    ).toFormat('HH:mm')}`
  );

// With the year, for a table that runs back into previous years.
export const sessionDay = (session: TrainingSessionView) =>
  safe(london(session.startsAt).toFormat('ccc d LLL yyyy'));

export const sessionTimes = (session: TrainingSessionView) =>
  safe(
    `${london(session.startsAt).toFormat('HH:mm')}–${london(
      session.endsAt
    ).toFormat('HH:mm')}`
  );

export const trainerLabel = (session: TrainingSessionView): Html =>
  pipe(
    session.trainer.name,
    O.match(
      () => html`member ${safe(String(session.trainer.memberNumber))}`,
      name => html`${sanitizeString(name)}`
    )
  );

export const spacesLeft = (session: TrainingSessionView) => {
  const left = Math.max(session.spaces - session.booked, 0);
  return left === 0
    ? html`full`
    : html`${safe(String(left))} of ${safe(String(session.spaces))}
      space${session.spaces === 1 ? safe('') : safe('s')} left`;
};

// The trainer's own markdown, escaped before it is formatted.
export const renderDescription = (session: TrainingSessionView): Html =>
  session.description === ''
    ? html``
    : html`<div class="training-description">
        ${safe(markdownToHtml(session.description))}
      </div>`;

const renderSession =
  (withDescriptions: boolean) =>
  (session: TrainingSessionView): Html => html`
    <li>
      <strong>${when(session)}</strong> with ${trainerLabel(session)} ·
      ${spacesLeft(session)}
      ${withDescriptions ? renderDescription(session) : html``}
    </li>
  `;

export const renderUpcomingTrainingSessions = (
  sessions: ReadonlyArray<TrainingSessionView>,
  options: {withDescriptions: boolean} = {withDescriptions: false}
): Html =>
  sessions.length === 0
    ? html`<p class="upcoming-trainings__empty">
        No trainings are arranged yet.
      </p>`
    : html`<ul class="upcoming-trainings">
        ${joinHtml(sessions.map(renderSession(options.withDescriptions)))}
      </ul>`;
