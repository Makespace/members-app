import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';
import {ReminderStage} from './reminder-stage';
import {
  currentAgreement,
  findAgreementVersion,
  ORIGINAL_AGREEMENT_KEY,
} from './versions';

// An owner signs a version of the Owners' Agreement (see ./versions). The
// original had no end date; from October 2026 a signature lasts a six month
// term, and the owner re-signs before it ends to carry on.

// How long before a term ends the owner is asked to re-sign.
const RENEWAL_WINDOW_MONTHS = 1;

const reminderStages: ReadonlyArray<{
  stage: ReminderStage;
  before: (termEnds: DateTime) => DateTime;
}> = [
  {stage: 'day', before: end => end.minus({days: 1})},
  {stage: 'week', before: end => end.minus({weeks: 1})},
  {stage: 'month', before: end => end.minus({months: RENEWAL_WINDOW_MONTHS})},
];

const urgency = (stage: ReminderStage) =>
  reminderStages.length -
  reminderStages.findIndex(candidate => candidate.stage === stage);

export type InterestedIn = {
  equipment: ReadonlyArray<string>;
  area: ReadonlyArray<string>;
};

// The latest agreement an owner has signed.
export type SignedOwnerAgreement = {
  // Which version they signed - its key in ./versions.
  version: string;
  signedAt: Date;
  // When the current term ends. None for a version without a term.
  termEnds: O.Option<Date>;
  // The responsibilities they said they're interested in taking on.
  interestedIn: InterestedIn;
  // The most urgent reminder sent for the current term, if any.
  reminderSent: O.Option<ReminderStage>;
};

// From the member's stored columns; none if they've never signed.
export const signedOwnerAgreementFromRow = (row: {
  agreementSigned: Date | null;
  agreementVersion: string | null;
  agreementTermEnds: Date | null;
  agreementInterestedIn: InterestedIn | null;
  agreementReminderSent: ReminderStage | null;
}): O.Option<SignedOwnerAgreement> =>
  row.agreementSigned === null
    ? O.none
    : O.some({
        version: row.agreementVersion ?? ORIGINAL_AGREEMENT_KEY,
        signedAt: row.agreementSigned,
        termEnds: O.fromNullable(row.agreementTermEnds),
        interestedIn: row.agreementInterestedIn ?? {equipment: [], area: []},
        reminderSent: O.fromNullable(row.agreementReminderSent),
      });

const utc = (date: Date) => DateTime.fromJSDate(date, {zone: 'utc'});

// When a signature of the given version ends, or none if that version has no
// term. A term runs from signing; re-signing before the current term has
// ended starts the new term where the current one ends, so renewing early
// never loses anyone time.
export const termEndsFor = (
  version: string,
  signedAt: Date,
  previousTermEnds: O.Option<Date>
): O.Option<Date> => {
  const termMonths = O.toNullable(
    O.chain((found: {termMonths: number | null}) =>
      O.fromNullable(found.termMonths)
    )(findAgreementVersion(version))
  );
  if (termMonths === null) {
    return O.none;
  }
  const start =
    O.isSome(previousTermEnds) && previousTermEnds.value > signedAt
      ? previousTermEnds.value
      : signedAt;
  return O.some(utc(start).plus({months: termMonths}).toJSDate());
};

export const renewalOpensAt = (termEnds: Date): Date =>
  utc(termEnds).minus({months: RENEWAL_WINDOW_MONTHS}).toJSDate();

export type OwnerAgreementStatus =
  // Never signed any version.
  | {state: 'unsigned'}
  // Signed an earlier version, but not the current one.
  | {state: 'outdated'; signedAt: Date; version: string}
  // Signed the current version and within its term.
  | {state: 'signed'; termEnds: Date}
  // Within a month of the term ending: time to re-sign.
  | {state: 'renewal-due'; termEnds: Date}
  // The term has ended without being renewed.
  | {state: 'lapsed'; termEnds: Date};

export const ownerAgreementStatus = (
  agreement: O.Option<SignedOwnerAgreement>,
  now: Date
): OwnerAgreementStatus => {
  if (O.isNone(agreement)) {
    return {state: 'unsigned'};
  }
  const {version, signedAt, termEnds} = agreement.value;
  if (version !== currentAgreement.key || O.isNone(termEnds)) {
    return {state: 'outdated', signedAt, version};
  }
  if (now >= termEnds.value) {
    return {state: 'lapsed', termEnds: termEnds.value};
  }
  if (now >= renewalOpensAt(termEnds.value)) {
    return {state: 'renewal-due', termEnds: termEnds.value};
  }
  return {state: 'signed', termEnds: termEnds.value};
};

// Re-signing is only offered once a renewal is due (or the term has lapsed),
// or to move onto the current version. Signing again mid-term would push the
// end date out another six months, which a double-click could do by accident.
export const canSign = (
  agreement: O.Option<SignedOwnerAgreement>,
  now: Date
): boolean => ownerAgreementStatus(agreement, now).state !== 'signed';

// The reminder to send now, if any: the most urgent stage reached that hasn't
// already been sent this term. Stages missed along the way (the worker was
// down, say) are skipped rather than sent late, and nothing is sent once the
// term has ended.
export const reminderDue = (
  agreement: O.Option<SignedOwnerAgreement>,
  now: Date
): O.Option<ReminderStage> => {
  if (O.isNone(agreement) || O.isNone(agreement.value.termEnds)) {
    return O.none;
  }
  const termEnds = utc(agreement.value.termEnds.value);
  if (utc(now) >= termEnds) {
    return O.none;
  }
  const reached = reminderStages.find(
    ({before}) => utc(now) >= before(termEnds)
  );
  if (!reached) {
    return O.none;
  }
  const sent = agreement.value.reminderSent;
  if (O.isSome(sent) && urgency(sent.value) >= urgency(reached.stage)) {
    return O.none;
  }
  return O.some(reached.stage);
};
