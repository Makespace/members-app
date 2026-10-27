import {constructEvent, DomainEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {v4} from 'uuid';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {Actor} from '../../types/actor';
import {SharedReadModel} from '../../read-models/shared-state';
import {UUID} from 'io-ts-types';

// The machine-status answers, in the order they appear on the form. Stored as
// a single readable string on the ticket, like the Google Form's answer.
export const MACHINE_STATUSES = [
  "It's not working",
  "It's working but not adjusted/configured correctly",
  'It was not found in the correct condition',
  'It is unsafe',
  'Consumables needed',
] as const;

// Checkbox lists arrive as a single value, an array, or not at all.
const checkboxList = new t.Type<ReadonlyArray<string>, unknown, unknown>(
  'checkboxList',
  (u): u is ReadonlyArray<string> =>
    Array.isArray(u) && u.every(item => typeof item === 'string'),
  u => {
    if (u === undefined || u === '') {
      return t.success([]);
    }
    if (typeof u === 'string') {
      return t.success([u]);
    }
    if (Array.isArray(u) && u.every(item => typeof item === 'string')) {
      return t.success(u as ReadonlyArray<string>);
    }
    return t.failure(u, [], 'not a list of checkbox values');
  },
  t.identity
);

export const trimmed = new t.Type<string, unknown, unknown>(
  'trimmed',
  (u): u is string => typeof u === 'string',
  u => (typeof u === 'string' ? t.success(u.trim()) : t.success('')),
  t.identity
);

// The form's "Other / not listed here" choice. The select is required, so
// it cannot post an empty value; it posts this word instead, and the
// server has to know it. It once did not: every report of unlisted
// equipment was refused at the door, whatever the member had written.
export const NOT_LISTED = 'other';

// Either sentinel means "no machine picked": the member describes it in
// otherEquipmentDetail.
const isPicked = (equipmentId: string): boolean =>
  equipmentId !== '' && equipmentId !== NOT_LISTED;

// The questions about the problem itself, which every way of raising a
// ticket asks.
export const problemFields = {
  equipmentId: t.union([tt.UUID, t.literal(''), t.literal(NOT_LISTED)]),
  // Which unit, when the equipment stands for several machines.
  machine: tt.withFallback(trimmed, ''),
  otherEquipmentDetail: tt.withFallback(trimmed, ''),
  machineStatuses: checkboxList,
  attempting: trimmed,
  issue: trimmed,
  steps: tt.withFallback(trimmed, ''),
};

const baseCodec = t.strict(problemFields);

type Problem = t.TypeOf<typeof baseCodec>;

// What went wrong is the one answer an owner cannot work without, and an
// unnamed machine needs describing.
export const isCompleteReport = (input: Problem): boolean =>
  input.issue !== '' &&
  (isPicked(input.equipmentId) || input.otherEquipmentDetail !== '');

const codec = t.refinement(baseCodec, isCompleteReport, 'RaiseTroubleTicket');

type RaiseTroubleTicket = t.TypeOf<typeof codec>;

// Who reported it, as far as the ticket is concerned.
export type Reporter = {
  memberNumber: number | null;
  providedMemberNumber: number | null;
  email: string | null;
  name: string;
};

export const ticketCreated = (
  rm: SharedReadModel,
  problem: Problem,
  reporter: Reporter,
  source: 'app' | 'public',
  actor: Actor
): TE.TaskEither<FailureWithStatus, O.Option<DomainEvent>> => {
  const picked = isPicked(problem.equipmentId);
  const equipment = picked
    ? rm.equipment.get(problem.equipmentId as UUID)
    : O.none;
  if (picked && O.isNone(equipment)) {
    return TE.left(
      failureWithStatus('No such equipment', StatusCodes.BAD_REQUEST)()
    );
  }
  const submittedAt = new Date();
  return TE.right(
    O.some(
      constructEvent('TroubleTicketCreated')({
        id: v4() as UUID,
        // Tickets raised in the app have no sheet row; the hash is only a
        // uniqueness key, and a fresh uuid can never collide with an import.
        rowHash: `app:${v4()}`,
        sheetId: 'app',
        submittedAt,
        submittedMemberNumber: reporter.memberNumber,
        providedMemberNumber: reporter.providedMemberNumber,
        submittedEmail: reporter.email,
        submittedName: reporter.name,
        // The name is kept for display alongside imported tickets; the picked
        // equipmentId is what actually places the ticket.
        submittedEquipment: pipe(
          equipment,
          O.map(found => found.name),
          O.toNullable
        ),
        equipmentId: O.toNullable(
          pipe(
            equipment,
            O.map(found => found.id)
          )
        ),
        machine: problem.machine,
        areaId: null,
        title: '',
        mailboxConversationId: '',
        otherEquipmentDetail: problem.otherEquipmentDetail,
        status: problem.machineStatuses.join(', '),
        attempting: problem.attempting,
        issue: problem.issue,
        steps: problem.steps,
        source,
        actor,
      })
    )
  );
};

const process: Command<RaiseTroubleTicket>['process'] = input => {
  if (input.command.actor.tag !== 'user') {
    return TE.left(
      failureWithStatus(
        'Only a logged-in member can raise a trouble ticket',
        StatusCodes.UNAUTHORIZED
      )()
    );
  }
  const user = input.command.actor.user;
  return ticketCreated(
    input.rm,
    input.command,
    {
      memberNumber: user.memberNumber,
      providedMemberNumber: null,
      email: user.emailAddress,
      name: pipe(
        input.rm.members.getByMemberNumber(user.memberNumber),
        O.chain(found => found.name),
        O.getOrElse(() => '')
      ),
    },
    'app',
    input.command.actor
  );
};

// Any logged-in member can report a problem - that is the point of the form.
export const raise: Command<RaiseTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: input => input.actor.tag === 'user',
};
