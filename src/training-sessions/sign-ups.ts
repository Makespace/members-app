import {DateTime} from 'luxon';

// The choices a trainer has for when members stop being able to sign up:
// 0 is "when it starts".
export const SIGN_UPS_CLOSE_CHOICES = [0, 1, 2, 4, 12, 24, 48] as const;

export const DEFAULT_SIGN_UPS_CLOSE_HOURS_BEFORE = 1;

export const signUpsCloseAt = (startsAt: Date, hoursBefore: number): Date =>
  DateTime.fromJSDate(startsAt).minus({hours: hoursBefore}).toJSDate();

export const describeSignUpsClose = (hoursBefore: number): string =>
  hoursBefore === 0
    ? 'When it starts'
    : `${hoursBefore} hour${hoursBefore === 1 ? '' : 's'} before`;

type SessionForSignUp = {
  trainerMemberNumber: number;
  spaces: number;
  attendees: ReadonlyArray<number>;
  signUpsCloseAt: Date;
  startsAt: Date;
  cancelled: boolean;
};

// Where one member stands with one session, in the order that matters to
// them: being booked on it outranks it being full, which is what being
// booked does to a session.
export type SignUpStatus =
  | 'cancelled'
  | 'booked'
  | 'trainer'
  | 'closed'
  | 'full'
  | 'open';

export const signUpStatus = (
  session: SessionForSignUp,
  memberNumber: number,
  now: Date
): SignUpStatus => {
  if (session.cancelled) {
    return 'cancelled';
  }
  if (session.attendees.includes(memberNumber)) {
    return 'booked';
  }
  if (session.trainerMemberNumber === memberNumber) {
    return 'trainer';
  }
  if (now >= session.signUpsCloseAt) {
    return 'closed';
  }
  if (session.attendees.length >= session.spaces) {
    return 'full';
  }
  return 'open';
};

// A member can give up their place right up to the start: a late
// cancellation still tells the trainer not to wait for them.
export const canCancelPlace = (session: SessionForSignUp, now: Date) =>
  !session.cancelled && now < session.startsAt;
