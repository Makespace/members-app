import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {isTicketOwner} from './authorization';

// HTML checkboxes submit 'on' when ticked and nothing when not.
const checkbox = new t.Type<boolean, unknown, unknown>(
  'checkbox',
  (u): u is boolean => typeof u === 'boolean',
  u => t.success(u === 'on' || u === 'true' || u === true),
  t.identity
);

const baseCodec = t.strict({
  ticketId: tt.UUID,
  summary: t.string,
  quiet: checkbox,
});

// A summary is required only when the submitter will be emailed. A quiet
// resolve is backlog clearing - the ticket was dealt with long ago, outside
// the app, and there is nothing to write.
const codec = t.refinement(
  baseCodec,
  input => input.quiet || input.summary.trim() !== '',
  'ResolveTroubleTicket'
);

type ResolveTroubleTicket = t.TypeOf<typeof codec>;

// Resolve a ticket, recording a summary of what was done.
const process: Command<ResolveTroubleTicket>['process'] = input =>
  pipe(
    input.rm.troubleTickets.getById(input.command.ticketId),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested trouble ticket does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    TE.map(() =>
      O.some(
        constructEvent('TroubleTicketResolved')({
          ticketId: input.command.ticketId,
          summary: input.command.summary.trim(),
          quiet: input.command.quiet,
          actor: input.command.actor,
        })
      )
    )
  );

export const resolve: Command<ResolveTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: isTicketOwner,
};
