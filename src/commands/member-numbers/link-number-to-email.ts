import * as RA from 'fp-ts/ReadonlyArray';
import {EmailAddressCodec, constructEvent, isEventOfType} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {pipe} from 'fp-ts/lib/function';
import {EventOfType} from '../../types/domain-event';
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

const isUsingAlreadyUsedEmail = (
  event: EventOfType<'MemberNumberLinkedToEmail'>,
  command: LinkNumberToEmail
) => event.email === command.email;

const isDuplicateOfPreviousCommand = (
  event: EventOfType<'MemberNumberLinkedToEmail'>,
  command: LinkNumberToEmail
) =>
  // Different name != different event.
  event.email === command.email && event.memberNumber === command.memberNumber;

const process: Command<LinkNumberToEmail>['process'] = input =>
  pipe(
    input.events,
    RA.filter(isEventOfType('MemberNumberLinkedToEmail')),
    RA.filter(
      event =>
        event.email === input.command.email ||
        event.memberNumber === input.command.memberNumber
    ),
    RA.matchW(
      () =>
        TE.right(
          O.some(constructEvent('MemberNumberLinkedToEmail')(input.command))
        ),
      events => {
        if (isDuplicateOfPreviousCommand(events[0], input.command)) {
          return TE.right(O.none);
        }
        if (isUsingAlreadyUsedEmail(events[0], input.command)) {
          return TE.right(
            O.some(
              constructEvent('LinkingMemberNumberToAnAlreadyUsedEmailAttempted')(
                input.command
              )
            )
          );
        }
        return TE.left(
          failureWithStatus(
            'The requested member number is already linked to an email address',
            StatusCodes.BAD_REQUEST
          )()
        );
      }
    )
  );

const resource = () => ({
  type: 'MemberNumberEmailPairings',
  id: 'MemberNumberEmailPairings',
});

export const linkNumberToEmail: Command<LinkNumberToEmail> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
