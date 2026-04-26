import {EmailAddressCodec, constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../../types/failure-with-status';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  email: EmailAddressCodec,
  memberNumber: tt.NumberFromString,
  name: tt.withFallback(t.union([t.string, t.undefined]), undefined),
  formOfAddress: tt.withFallback(t.union([t.string, t.undefined]), undefined),
});

export type LinkNumberToEmail = t.TypeOf<typeof codec>;

const process: Command<LinkNumberToEmail>['process'] = input =>
  (() => {
    const currentMember = input.rm.members.getByMemberNumber(
      input.command.memberNumber
    );
    const ownerOfEmail = input.rm.members.getByEmail(input.command.email, false);

    if (
      O.isSome(currentMember) &&
      O.isSome(ownerOfEmail) &&
      currentMember.value.userId === ownerOfEmail.value.userId
    ) {
      return TE.right(O.none);
    }

    if (O.isSome(currentMember)) {
      return TE.left(
        failureWithStatus(
          'The requested member number is already linked to an email address',
          StatusCodes.BAD_REQUEST
        )()
      );
    }

    if (O.isSome(ownerOfEmail)) {
      return TE.right(
        O.some(
          constructEvent('LinkingMemberNumberToAnAlreadyUsedEmailAttempted')(
            input.command
          )
        )
      );
    }

    return TE.right(
      O.some(constructEvent('MemberNumberLinkedToEmail')(input.command))
    );
  })();

export const linkNumberToEmail: Command<LinkNumberToEmail> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
