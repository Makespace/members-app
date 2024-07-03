import * as RA from 'fp-ts/ReadonlyArray';
import {EmailAddressCodec, constructEvent, isEventOfType} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {pipe} from 'fp-ts/lib/function';

const codec = t.strict({
  email: EmailAddressCodec,
  memberNumber: tt.NumberFromString,
});

type LinkNumberToEmail = t.TypeOf<typeof codec>;

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
      event =>
        event[0].email === input.command.email
          ? O.some(
              constructEvent(
                'LinkingMemberNumberToAnAlreadyUsedEmailAttempted'
              )(input.command)
            )
          : O.none
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
