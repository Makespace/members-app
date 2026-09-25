import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {v4} from 'uuid';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
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

const trimmed = new t.Type<string, unknown, unknown>(
  'trimmed',
  (u): u is string => typeof u === 'string',
  u => (typeof u === 'string' ? t.success(u.trim()) : t.success('')),
  t.identity
);

const baseCodec = t.strict({
  // '' means "not listed" - the member describes it in otherEquipmentDetail.
  equipmentId: t.union([tt.UUID, t.literal('')]),
  // Which unit, when the equipment stands for several machines.
  machine: tt.withFallback(trimmed, ''),
  otherEquipmentDetail: tt.withFallback(trimmed, ''),
  machineStatuses: checkboxList,
  attempting: trimmed,
  issue: trimmed,
  steps: tt.withFallback(trimmed, ''),
});

// What went wrong is the one answer an owner cannot work without, and an
// unnamed machine needs describing.
const codec = t.refinement(
  baseCodec,
  input =>
    input.issue !== '' &&
    (input.equipmentId !== '' || input.otherEquipmentDetail !== ''),
  'RaiseTroubleTicket'
);

type RaiseTroubleTicket = t.TypeOf<typeof codec>;

const process: Command<RaiseTroubleTicket>['process'] = input => {
  if (input.command.actor.tag !== 'user') {
    return TE.left(
      failureWithStatus(
        'Only a logged-in member can raise a trouble ticket',
        StatusCodes.UNAUTHORIZED
      )()
    );
  }
  const member = input.rm.members.getByMemberNumber(
    input.command.actor.user.memberNumber
  );
  const equipment =
    input.command.equipmentId === ''
      ? O.none
      : input.rm.equipment.get(input.command.equipmentId as UUID);
  if (input.command.equipmentId !== '' && O.isNone(equipment)) {
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
        submittedMemberNumber: input.command.actor.user.memberNumber,
        submittedEmail: input.command.actor.user.emailAddress,
        submittedName: pipe(
          member,
          O.chain(found => found.name),
          O.getOrElse(() => '')
        ),
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
        machine: input.command.machine,
        areaId: null,
        title: '',
        mailboxConversationId: '',
        otherEquipmentDetail: input.command.otherEquipmentDetail,
        status: input.command.machineStatuses.join(', '),
        attempting: input.command.attempting,
        issue: input.command.issue,
        steps: input.command.steps,
        source: 'app',
        actor: input.command.actor,
      })
    )
  );
};

// Any logged-in member can report a problem - that is the point of the form.
export const raise: Command<RaiseTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: input => input.actor.tag === 'user',
};
