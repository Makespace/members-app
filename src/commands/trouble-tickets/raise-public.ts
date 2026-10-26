import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {EmailAddress, EmailAddressCodec} from '../../types/email-address';
import {SharedReadModel} from '../../read-models/shared-state';
import {Member} from '../../read-models/shared-state/return-types';
import {
  isCompleteReport,
  problemFields,
  Reporter,
  ticketCreated,
  trimmed,
} from './raise';

// The form's optional boxes post '' when left empty.
const optionalEmail = new t.Type<EmailAddress | null, unknown, unknown>(
  'optionalEmail',
  (u): u is EmailAddress | null => u === null || EmailAddressCodec.is(u),
  (u, c) => {
    const value = typeof u === 'string' ? u.trim() : '';
    if (value === '') {
      return t.success(null);
    }
    return EmailAddressCodec.is(value)
      ? t.success(value)
      : t.failure(u, c, 'That email address does not look right');
  },
  t.identity
);

const optionalMemberNumber = new t.Type<number | null, unknown, unknown>(
  'optionalMemberNumber',
  (u): u is number | null => u === null || typeof u === 'number',
  (u, c) => {
    const value = typeof u === 'string' ? u.trim() : '';
    if (value === '') {
      return t.success(null);
    }
    return /^\d{1,9}$/.test(value)
      ? t.success(Number(value))
      : t.failure(u, c, 'A member number is digits only');
  },
  t.identity
);

const codec = t.refinement(
  t.strict({
    ...problemFields,
    reporterName: tt.withFallback(trimmed, ''),
    reporterEmail: optionalEmail,
    reporterMemberNumber: optionalMemberNumber,
  }),
  isCompleteReport,
  'RaisePublicTroubleTicket'
);

type RaisePublicTroubleTicket = t.TypeOf<typeof codec>;

// The member whose account holds this address, matched the way logging in
// matches it, so "Jo@Example.com" finds jo@example.com.
const memberWithEmail = (
  rm: SharedReadModel,
  email: EmailAddress
): O.Option<Member> =>
  pipe(
    rm.members.resolveEmailForLogin(email, false),
    O.chain(stored => rm.members.getByEmail(stored, false))
  );

// Who this report is from, as far as we can tell. Only an email address puts
// a ticket on somebody's account: the confirmation goes to that address, so
// whoever reads it is the person the ticket is attributed to. A member number
// on its own is easy to type and proves nothing, so it is kept as what they
// said, for the owners to see, and the emailed link lets them claim the
// ticket properly.
const reconcileReporter = (
  rm: SharedReadModel,
  given: {
    name: string;
    email: EmailAddress | null;
    memberNumber: number | null;
  }
): Reporter => {
  const member = pipe(
    O.fromNullable(given.email),
    O.chain(email => memberWithEmail(rm, email))
  );
  return pipe(
    member,
    O.match(
      (): Reporter => ({
        memberNumber: null,
        providedMemberNumber: given.memberNumber,
        email: given.email,
        name: given.name,
      }),
      (found): Reporter => ({
        memberNumber: found.memberNumber,
        // A different number from the account's is worth an owner seeing.
        providedMemberNumber:
          given.memberNumber === found.memberNumber ? null : given.memberNumber,
        email: given.email,
        name:
          given.name !== ''
            ? given.name
            : O.getOrElse(() => '')(found.name),
      })
    )
  );
};

const process: Command<RaisePublicTroubleTicket>['process'] = input => {
  if (input.command.actor.tag !== 'public') {
    return TE.left(
      failureWithStatus(
        'This form is for people who are not logged in',
        StatusCodes.BAD_REQUEST
      )()
    );
  }
  return ticketCreated(
    input.rm,
    input.command,
    reconcileReporter(input.rm, {
      name: input.command.reporterName,
      email: input.command.reporterEmail,
      memberNumber: input.command.reporterMemberNumber,
    }),
    'public',
    input.command.actor
  );
};

// Raised from the public form by somebody who has not logged in. The HTTP
// handler is where the spam checks live; see public-report-guard.
export const raisePublic: Command<RaisePublicTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: input => input.actor.tag === 'public',
};
