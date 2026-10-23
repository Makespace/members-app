import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {hasInvitation, invitationFor} from './authorization';

const codec = t.strict({
  ticketId: tt.UUID,
});

type DeclineTroubleTicketInvitation = t.TypeOf<typeof codec>;

// The invitee turns down an invitation to help. (Accepting needs no command
// of its own: it is assigning themselves.) With no invitation outstanding -
// already answered - there is nothing to do.
const process: Command<DeclineTroubleTicketInvitation>['process'] = input =>
  TE.right(
    pipe(
      invitationFor(input.command.actor, input.rm, input.command.ticketId),
      O.map(invitation =>
        constructEvent('TroubleTicketInvitationDeclined')({
          ticketId: input.command.ticketId,
          inviterMemberNumber: invitation.inviterMemberNumber,
          actor: input.command.actor,
        })
      )
    )
  );

export const declineInvitation: Command<DeclineTroubleTicketInvitation> = {
  process,
  decode: codec.decode,
  isAuthorized: hasInvitation,
};
