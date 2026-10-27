import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {Config} from '../configuration';
import {createSignedToken, verifyToken} from '../authentication/signed-token';
import {Failure, failure} from '../types/failure';

// The link in the confirmation of a ticket raised without logging in. It is
// only ever sent to the address on the ticket, so whoever follows it read
// that inbox, and may take the ticket onto their account.
const ClaimTokenPayload = t.type({
  purpose: t.literal('TroubleTicketClaim'),
  ticketId: tt.UUID,
});

const claimPath = '/trouble-tickets/claim';

export const claimUrl = (conf: Config, ticketId: UUID): string =>
  pipe(
    {purpose: 'TroubleTicketClaim' as const, ticketId},
    // Long enough to sit in an inbox until somebody gets round to it.
    createSignedToken<t.TypeOf<typeof ClaimTokenPayload>>(conf, '180d'),
    token => `${conf.PUBLIC_URL}${claimPath}?token=${token}`
  );

export const ticketIdFromClaimToken = (
  token: string,
  secret: Config['TOKEN_SECRET']
): E.Either<Failure, UUID> =>
  pipe(
    verifyToken(token, secret),
    E.chainW(payload =>
      pipe(
        ClaimTokenPayload.decode(payload),
        E.mapLeft(() => failure('Not a trouble ticket link')())
      )
    ),
    E.map(payload => payload.ticketId)
  );
