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

const codec = t.strict({
  ticketId: tt.UUID,
  title: tt.NonEmptyString,
});

type EditTroubleTicketTitle = t.TypeOf<typeof codec>;

// An owner edits the ticket's title.
const process: Command<EditTroubleTicketTitle>['process'] = input =>
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
        constructEvent('TroubleTicketTitleEdited')({
          ticketId: input.command.ticketId,
          title: input.command.title,
          actor: input.command.actor,
        })
      )
    )
  );

export const editTitle: Command<EditTroubleTicketTitle> = {
  process,
  decode: codec.decode,
  isAuthorized: isTicketOwner,
};
