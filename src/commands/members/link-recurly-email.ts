import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {EmailAddressCodec, constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';
import {isRecurlyAddress} from '../../read-models/external-state/recurly-account-match';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  email: EmailAddressCodec,
});

type LinkRecurlyEmail = t.TypeOf<typeof codec>;

// Attaches an address Recurly bills to a member as verified, on the admin's
// word. Only an address Recurly actually holds (as billing email or account
// code) qualifies, so this cannot be used to hand out log-in addresses that
// no billing record stands behind.
const process: Command<LinkRecurlyEmail>['process'] = input => {
  const member = input.rm.members.getByMemberNumber(input.command.memberNumber);
  if (O.isNone(member)) {
    return TE.left(
      failureWithStatus('The requested member does not exist', StatusCodes.NOT_FOUND)()
    );
  }
  // Addresses are stored with the local part's case as given, so compare
  // lowercased: Recurly holds the lowercased form, and a member may have
  // added theirs with capitals.
  const wanted = normaliseEmailAddress(input.command.email).toLowerCase();
  const sameAddress = (candidate: string) => candidate.toLowerCase() === wanted;

  const otherHolder = input.rm.members
    .getAllCore()
    .find(
      other =>
        other.userId !== member.value.userId &&
        other.emails.some(e => sameAddress(e.emailAddress))
    );
  if (otherHolder !== undefined) {
    return TE.left(
      failureWithStatus(
        'That address already belongs to another member',
        StatusCodes.BAD_REQUEST
      )()
    );
  }
  const existing = member.value.emails.find(e => sameAddress(e.emailAddress));
  if (existing !== undefined && O.isSome(existing.verifiedAt)) {
    return TE.right(O.none);
  }
  // Keep the spelling the member already has, so the event verifies that
  // row rather than adding a second one in another case.
  const email = existing?.emailAddress ?? input.command.email;

  const deps = input.deps;
  if (deps === undefined) {
    return TE.left(
      failureWithStatus('Recurly data is not available', StatusCodes.INTERNAL_SERVER_ERROR)()
    );
  }
  return pipe(
    TE.tryCatch(
      () => isRecurlyAddress(deps.extDB)(email),
      () => failureWithStatus('Could not read Recurly data', StatusCodes.INTERNAL_SERVER_ERROR)()
    ),
    TE.chain(known =>
      known
        ? TE.right(
            O.some(
              constructEvent('MemberEmailLinkedByAdmin')({
                actor: input.command.actor,
                memberNumber: input.command.memberNumber,
                email,
              })
            )
          )
        : TE.left(
            failureWithStatus(
              'Recurly has no account with that address; only an address Recurly bills can be linked this way',
              StatusCodes.BAD_REQUEST
            )()
          )
    )
  );
};

export const linkRecurlyEmail: Command<LinkRecurlyEmail> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
