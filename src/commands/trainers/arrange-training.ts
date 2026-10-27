import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {Command} from '../command';
import {isEquipmentTrainer} from '../authentication-helpers/is-equipment-trainer';
import {
  DEFAULT_SIGN_UPS_CLOSE_HOURS_BEFORE,
  SIGN_UPS_CLOSE_CHOICES,
} from '../../training-sessions/sign-ups';

// Enough for any session the space could hold; a typo of 200 is not.
export const MAX_SPACES = 50;

const ZONE = 'Europe/London';

// What the form sends: a day and two times on it, as the browser's date and
// time inputs write them, and any members already booked in. Those arrive as
// one value or several depending on how many inputs the trainer used, and an
// input left empty sends an empty string.
const formCodec = t.intersection([
  t.strict({
    sessionId: tt.UUID,
    equipmentId: tt.UUID,
    date: t.string,
    startTime: t.string,
    endTime: t.string,
    spaces: t.union([t.Int, tt.IntFromString]),
  }),
  t.partial({
    description: t.string,
    attendees: t.union([t.string, t.array(t.string)]),
    signUpsCloseHoursBefore: t.union([t.Int, tt.IntFromString]),
  }),
]);

const ArrangeTrainingCodec = t.strict({
  sessionId: tt.UUID,
  equipmentId: tt.UUID,
  startsAt: tt.date,
  endsAt: tt.date,
  spaces: t.number,
  description: t.string,
  attendees: t.array(t.number),
  signUpsCloseHoursBefore: t.number,
});

export const MAX_DESCRIPTION_LENGTH = 2000;

const attendeesFrom = (
  raw: string | ReadonlyArray<string> | undefined
): O.Option<Array<number>> => {
  const given = (raw === undefined ? [] : typeof raw === 'string' ? [raw] : raw)
    .map(value => value.trim())
    .filter(value => value !== '');
  if (!given.every(value => /^\d+$/.test(value))) {
    return O.none;
  }
  return O.some([...new Set(given.map(Number))]);
};

export type ArrangeTraining = t.TypeOf<typeof ArrangeTrainingCodec>;

// The times are what a trainer means on the wall clock at the space, whatever
// zone the server or their phone happens to be in.
const atLondonTime = (date: string, time: string): O.Option<DateTime> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return O.none;
  }
  const parsed = DateTime.fromISO(`${date}T${time}`, {zone: ZONE});
  return parsed.isValid ? O.some(parsed) : O.none;
};

// Turns the form into the instants the session runs between. Everything here
// is a check on the form alone; whether the machine exists and whether the
// time has passed are for process.
const codec = new t.Type<ArrangeTraining, ArrangeTraining, unknown>(
  'ArrangeTraining',
  ArrangeTrainingCodec.is,
  (input, context) =>
    pipe(
      formCodec.validate(input, context),
      E.chain(form => {
        const startsAt = atLondonTime(form.date, form.startTime);
        const endsAt = atLondonTime(form.date, form.endTime);
        if (O.isNone(startsAt) || O.isNone(endsAt)) {
          return t.failure(input, context, 'Please give a day and two times');
        }
        if (endsAt.value <= startsAt.value) {
          return t.failure(
            input,
            context,
            'The training must end after it starts'
          );
        }
        if (form.spaces < 1 || form.spaces > MAX_SPACES) {
          return t.failure(
            input,
            context,
            `The number of spaces must be between 1 and ${MAX_SPACES}`
          );
        }
        const description = (form.description ?? '').trim();
        if (description.length > MAX_DESCRIPTION_LENGTH) {
          return t.failure(
            input,
            context,
            `The description must be at most ${MAX_DESCRIPTION_LENGTH} characters`
          );
        }
        const attendees = attendeesFrom(form.attendees);
        if (O.isNone(attendees)) {
          return t.failure(
            input,
            context,
            'Members to book in must be given by member number'
          );
        }
        if (attendees.value.length > form.spaces) {
          return t.failure(
            input,
            context,
            'More members are booked in than there are spaces'
          );
        }
        const signUpsCloseHoursBefore =
          form.signUpsCloseHoursBefore ?? DEFAULT_SIGN_UPS_CLOSE_HOURS_BEFORE;
        if (
          !(SIGN_UPS_CLOSE_CHOICES as ReadonlyArray<number>).includes(
            signUpsCloseHoursBefore
          )
        ) {
          return t.failure(
            input,
            context,
            'Please choose when sign-ups close from the list'
          );
        }
        return t.success({
          sessionId: form.sessionId,
          equipmentId: form.equipmentId,
          startsAt: startsAt.value.toJSDate(),
          endsAt: endsAt.value.toJSDate(),
          spaces: form.spaces,
          description,
          attendees: attendees.value,
          signUpsCloseHoursBefore,
        });
      })
    ),
  t.identity
);

// Submitting the same form twice (a double click, a back-and-resubmit) is the
// same session, so it is recorded once.
const process: Command<ArrangeTraining>['process'] = input =>
  pipe(
    input.rm.equipment.get(input.command.equipmentId),
    TE.fromOption(failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)),
    TE.filterOrElse(
      () => input.command.startsAt > new Date(),
      () =>
        failureWithStatus(
          'A training has to be arranged for a time that has not passed yet',
          StatusCodes.BAD_REQUEST
        )()
    ),
    TE.chainFirst(() =>
      pipe(
        input.command.attendees.find(memberNumber =>
          O.isNone(input.rm.members.getByMemberNumber(memberNumber))
        ),
        unknown =>
          unknown === undefined
            ? TE.right(undefined)
            : TE.left(
                failureWithStatus(
                  `There is no member number ${unknown}`,
                  StatusCodes.BAD_REQUEST
                )()
              )
      )
    ),
    TE.map(() =>
      input.command.actor.tag !== 'user' ||
      O.isSome(input.rm.trainingSessions.get(input.command.sessionId))
        ? O.none
        : O.some(
            constructEvent('TrainingSessionScheduled')({
              sessionId: input.command.sessionId,
              equipmentId: input.command.equipmentId,
              trainerMemberNumber: input.command.actor.user.memberNumber,
              startsAt: input.command.startsAt,
              endsAt: input.command.endsAt,
              spaces: input.command.spaces,
              description: input.command.description,
              attendees: input.command.attendees,
              signUpsCloseHoursBefore: input.command.signUpsCloseHoursBefore,
              actor: input.command.actor,
            })
          )
    )
  );

// Only the machine's own trainers: the trainer is whoever arranges it, so a
// super-user who does not train on the machine has no session to put on.
export const arrangeTraining: Command<ArrangeTraining> = {
  process,
  decode: codec.decode,
  isAuthorized: isEquipmentTrainer,
};
