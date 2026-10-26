import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {SharedReadModel} from '../../read-models/shared-state';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';
import {TroubleTicket} from '../../types/trouble-ticket';
import {ticketIdFromClaimToken} from '../../trouble-tickets/claim-token';
import {Config} from '../../configuration';

const codec = t.strict({token: t.string});

type ClaimTroubleTicket = t.TypeOf<typeof codec>;

// Whose a ticket is, from where the member following the link stands.
export type ClaimState = 'claimable' | 'yours' | 'someone-else';

export const claimStateFor = (
  rm: SharedReadModel,
  ticket: TroubleTicket,
  memberNumber: number
): ClaimState => {
  if (ticket.submittedMemberNumber === null) {
    return 'claimable';
  }
  return pipe(
    rm.members.getByMemberNumber(memberNumber),
    O.map(allMemberNumbers),
    O.getOrElse((): ReadonlyArray<number> => [memberNumber])
  ).includes(ticket.submittedMemberNumber)
    ? 'yours'
    : 'someone-else';
};

// The ticket a claim link names, once the link is known to be ours.
export const ticketFromClaimToken = (
  rm: SharedReadModel,
  secret: Config['TOKEN_SECRET'],
  token: string
): E.Either<FailureWithStatus, TroubleTicket> =>
  pipe(
    ticketIdFromClaimToken(token, secret),
    E.mapLeft(() =>
      failureWithStatus(
        'This link is not valid. Please use the link from your confirmation email.',
        StatusCodes.BAD_REQUEST
      )()
    ),
    E.chain(ticketId =>
      pipe(
        rm.troubleTickets.getById(ticketId as UUID),
        E.fromOption(() =>
          failureWithStatus(
            'That trouble ticket no longer exists',
            StatusCodes.NOT_FOUND
          )()
        )
      )
    )
  );

const process: Command<ClaimTroubleTicket>['process'] = input => {
  const actor = input.command.actor;
  if (actor.tag !== 'user') {
    return TE.left(
      failureWithStatus('Please log in first', StatusCodes.UNAUTHORIZED)()
    );
  }
  if (input.deps === undefined) {
    return TE.left(
      failureWithStatus(
        'Cannot check the link',
        StatusCodes.INTERNAL_SERVER_ERROR
      )()
    );
  }
  return pipe(
    ticketFromClaimToken(
      input.rm,
      input.deps.conf.TOKEN_SECRET,
      input.command.token
    ),
    E.chain(ticket => {
      switch (claimStateFor(input.rm, ticket, actor.user.memberNumber)) {
        case 'yours':
          return E.right(O.none);
        case 'someone-else':
          return E.left(
            failureWithStatus(
              "This report is already on another member's account",
              StatusCodes.FORBIDDEN
            )()
          );
        case 'claimable':
          return E.right(
            O.some(
              constructEvent('TroubleTicketClaimed')({
                ticketId: ticket.id,
                memberNumber: actor.user.memberNumber,
                actor,
              })
            )
          );
      }
    }),
    TE.fromEither
  );
};

// Anybody holding the link may claim the ticket for themselves; the link is
// the proof, and it was only sent to the address on the ticket.
export const claim: Command<ClaimTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: input => input.actor.tag === 'user',
};
