import * as RA from 'fp-ts/ReadonlyArray';
import {EmailAddressCodec, constructEvent, isEventOfType} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {pipe} from 'fp-ts/lib/function';
import {EventOfType} from '../../types/domain-event';

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
      () => O.some(constructEvent('MemberNumberLinkedToEmail')(input.command)),
      events => {
        if (isDuplicateOfPreviousCommand(events[0], input.command)) {
          return O.none;
        }
        if (isUsingAlreadyUsedEmail(events[0], input.command)) {
          return O.some(
            constructEvent('LinkingMemberNumberToAnAlreadyUsedEmailAttempted')(
              input.command
            )
          );
        }
        return O.none;
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
