import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {v4} from 'uuid';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {constructEvent, EmailAddress} from '../../types';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {
  getInboxThread,
  InboxMessage,
} from '../../read-models/external-state/gmail-inbox';
import {senderAddress, senderName} from '../../types/email-sender';
import {managementOnly} from './conversation';

const trimmed = new t.Type<string, unknown, unknown>(
  'trimmed',
  (u): u is string => typeof u === 'string',
  u => (typeof u === 'string' ? t.success(u.trim()) : t.success('')),
  t.identity
);

const baseCodec = t.strict({
  conversationId: t.string,
  title: trimmed,
  issue: trimmed,
  steps: tt.withFallback(trimmed, ''),
});

// A ticket needs a name and a problem; the rest can wait.
const codec = t.refinement(
  baseCodec,
  input => input.title !== '' && input.issue !== '',
  'CreateTicketFromEmail'
);

type CreateTicketFromEmail = t.TypeOf<typeof codec>;

// Raises a trouble ticket from a mailbox conversation, for the management
// team. The sender of the email is recorded as the submitter - and matched to
// a member when their address is known - but is not written to: they did not
// use the app, and the reply belongs in the conversation.
const process: Command<CreateTicketFromEmail>['process'] = input =>
  pipe(
    managementOnly(input),
    TE.filterOrElse(
      deps => deps.conf.MANAGEMENT_TEAM_AREA_ID !== '',
      () =>
        failureWithStatus(
          'No management team area is configured, so there is nowhere to put the ticket',
          StatusCodes.INTERNAL_SERVER_ERROR
        )()
    ),
    TE.filterOrElse(
      deps =>
        O.isSome(input.rm.area.get(deps.conf.MANAGEMENT_TEAM_AREA_ID as UUID)),
      () =>
        failureWithStatus(
          'The configured management team area does not exist',
          StatusCodes.INTERNAL_SERVER_ERROR
        )()
    ),
    TE.chain(deps =>
      pipe(
        TE.tryCatch(
          () => getInboxThread(deps.extDB, input.command.conversationId),
          () =>
            failureWithStatus(
              'Failed to read the mailbox cache',
              StatusCodes.INTERNAL_SERVER_ERROR
            )()
        ),
        TE.filterOrElse(
          messages => messages.length > 0,
          () =>
            failureWithStatus('No such conversation', StatusCodes.NOT_FOUND)()
        ),
        TE.map(messages => ({deps, first: messages[0]}))
      )
    ),
    TE.map(({deps, first}) => O.some(ticketFrom(input, deps.conf.MANAGEMENT_TEAM_AREA_ID as UUID, first)))
  );

const ticketFrom = (
  input: Parameters<Command<CreateTicketFromEmail>['process']>[0],
  areaId: UUID,
  first: InboxMessage
) => {
  const from = first.fromAddress ?? '';
  const address = from === '' ? null : senderAddress(from);
  const member =
    address === null
      ? O.none
      : input.rm.members.getByEmail(address as EmailAddress, false);
  return constructEvent('TroubleTicketCreated')({
    id: v4() as UUID,
    // No sheet row behind this; the hash is only a uniqueness key.
    rowHash: `email:${v4()}`,
    sheetId: 'email',
    submittedAt: new Date(),
    submittedMemberNumber: pipe(
      member,
      O.map(found => found.memberNumber),
      O.toNullable
    ),
    submittedEmail: address,
    submittedName: from === '' ? null : senderName(from),
    submittedEquipment: null,
    otherEquipmentDetail: '',
    status: '',
    attempting: '',
    issue: input.command.issue,
    steps: input.command.steps,
    source: 'email',
    equipmentId: null,
    machine: '',
    areaId,
    title: input.command.title,
    // Named by its earliest message, whichever id the link used.
    mailboxConversationId: first.gmailMessageId,
    actor: input.command.actor,
  });
};

export const createTicket: Command<CreateTicketFromEmail> = {
  process,
  decode: codec.decode,
  // See managementOnly.
  isAuthorized: () => true,
};
