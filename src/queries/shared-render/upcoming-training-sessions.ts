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
import {
  SignUpStatus,
  signUpStatus,
} from '../../training-sessions/sign-ups';

type Person = {memberNumber: number; name: O.Option<string>};

export type TrainingSessionView = {
  id: UUID;
  startsAt: Date;
  endsAt: Date;
  trainer: Person;
  spaces: number;
  booked: number;
  // Who is booked, earliest first. Only trainers are shown the names.
  attendees: ReadonlyArray<Person>;
  description: string;
  signUpsCloseAt: Date;
  cancelled: O.Option<{at: Date; reason: string}>;
  // Where the member looking at the page stands with it, when the page is
  // one they can sign up from.
  yourStatus: O.Option<SignUpStatus>;
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
    O.alt(() => memberName(rm, memberNumber))
  );

const memberName = (rm: SharedReadModel, memberNumber: number) =>
  pipe(
    rm.members.getByMemberNumber(memberNumber),
    O.chain(member => member.name)
  );

export const toTrainingSessionView =
  (
    rm: SharedReadModel,
    equipment: Equipment,
    viewer: O.Option<{memberNumber: number; now: Date}> = O.none
  ) =>
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
    attendees: session.attendees.map(memberNumber => ({
      memberNumber,
      name: memberName(rm, memberNumber),
    })),
    description: session.description,
    signUpsCloseAt: session.signUpsCloseAt,
    cancelled: session.cancelled,
    yourStatus: pipe(
      viewer,
      O.map(({memberNumber, now}) =>
        signUpStatus(
          {...session, cancelled: O.isSome(session.cancelled)},
          memberNumber,
          now
        )
      )
    ),
  });

export const upcomingTrainingSessions = (
  rm: SharedReadModel,
  equipment: Equipment,
  now: Date,
  viewer: O.Option<{memberNumber: number}> = O.none
): ReadonlyArray<TrainingSessionView> =>
  rm.trainingSessions
    .upcomingForEquipment(equipment.id, now)
    .map(
      toTrainingSessionView(
        rm,
        equipment,
        pipe(
          viewer,
          O.map(({memberNumber}) => ({memberNumber, now}))
        )
      )
    );

const london = (date: Date) =>
  DateTime.fromJSDate(date).setZone('Europe/London').setLocale('en-GB');

// "Sat 7 Nov, 18:00–20:00": the day and the clock times are what people plan
// around, and the year only gets in the way for something weeks away.
export const sessionWhen = (session: Pick<TrainingSessionView, 'startsAt' | 'endsAt'>) =>
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

export const personLabel = (person: Person): Html =>
  pipe(
    person.name,
    O.match(
      () => html`member ${safe(String(person.memberNumber))}`,
      name => html`${sanitizeString(name)}`
    )
  );

export const trainerLabel = (session: TrainingSessionView): Html =>
  personLabel(session.trainer);

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

// What the member reading the page can do about a session.
export const yourPlace = (session: TrainingSessionView): Html =>
  pipe(
    session.yourStatus,
    O.match(
      () => html``,
      status => {
        switch (status) {
          case 'open':
            return html`<a
              class="button"
              href="/training-sessions/sign-up?sessionId=${safe(session.id)}"
              >Sign up</a
            >`;
          case 'booked':
            return html`<span class="training-session__yours"
                >You are booked on this one.</span
              >
              <a
                href="/training-sessions/cancel-place?sessionId=${safe(
                  session.id
                )}"
                >Cancel your place</a
              >`;
          case 'trainer':
            return html`<span class="training-session__yours"
              >You are running this one.</span
            >`;
          case 'closed':
            return html`<span class="training-session__closed"
              >Sign-ups have closed.</span
            >`;
          case 'full':
          case 'cancelled':
            return html``;
        }
      }
    )
  );

const renderSession =
  (withDescriptions: boolean) =>
  (session: TrainingSessionView): Html => html`
    <li>
      <strong>${sessionWhen(session)}</strong> with ${trainerLabel(session)} ·
      ${spacesLeft(session)}
      ${withDescriptions ? renderDescription(session) : html``}
      ${O.isSome(session.yourStatus)
        ? html`<div class="training-session__actions">
            ${yourPlace(session)}
          </div>`
        : html``}
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
