import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  allMemberNumbers,
  Equipment,
} from '../../read-models/shared-state/return-types';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';

export type UpcomingTrainingSession = {
  startsAt: Date;
  endsAt: Date;
  trainer: {memberNumber: number; name: O.Option<string>};
  spaces: number;
  booked: number;
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

export const upcomingTrainingSessions = (
  rm: SharedReadModel,
  equipment: Equipment,
  now: Date
): ReadonlyArray<UpcomingTrainingSession> =>
  rm.trainingSessions
    .upcomingForEquipment(equipment.id, now)
    .map(session => ({
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      trainer: {
        memberNumber: session.trainerMemberNumber,
        name: trainerName(rm, equipment, session.trainerMemberNumber),
      },
      spaces: session.spaces,
      booked: session.attendees.length,
    }));

const london = (date: Date) =>
  DateTime.fromJSDate(date).setZone('Europe/London').setLocale('en-GB');

// "Sat 7 Nov, 18:00–20:00": the day and the clock times are what people plan
// around, and the year only gets in the way for something weeks away.
const when = (session: UpcomingTrainingSession) =>
  safe(
    `${london(session.startsAt).toFormat('ccc d LLL, HH:mm')}–${london(
      session.endsAt
    ).toFormat('HH:mm')}`
  );

const renderSession = (session: UpcomingTrainingSession): Html => html`
  <li>
    <strong>${when(session)}</strong> with
    ${pipe(
      session.trainer.name,
      O.match(
        () => html`member ${safe(String(session.trainer.memberNumber))}`,
        name => html`${sanitizeString(name)}`
      )
    )}
    · ${spacesLeft(session)}
  </li>
`;

const spacesLeft = (session: UpcomingTrainingSession) => {
  const left = Math.max(session.spaces - session.booked, 0);
  return left === 0
    ? html`full`
    : html`${safe(String(left))} of ${safe(String(session.spaces))}
      space${session.spaces === 1 ? safe('') : safe('s')} left`;
};

export const renderUpcomingTrainingSessions = (
  sessions: ReadonlyArray<UpcomingTrainingSession>
): Html =>
  sessions.length === 0
    ? html`<p class="upcoming-trainings__empty">
        No trainings are arranged yet.
      </p>`
    : html`<ul class="upcoming-trainings">
        ${joinHtml(sessions.map(renderSession))}
      </ul>`;
