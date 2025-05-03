import * as RA from 'fp-ts/ReadonlyArray';
import {constructEvent, isEventOfType} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {pipe} from 'fp-ts/lib/function';
import {EventOfType} from '../../types/domain-event';

const codec = t.strict({
  memberNumber: tt.IntFromString,
});

export type MarkMemberRejoinedWithExistingNumber = t.TypeOf<typeof codec>;

const isDuplicateOfPreviousCommand =
  (command: MarkMemberRejoinedWithExistingNumber) =>
  (event: EventOfType<'MemberRejoinedWithExistingNumber'>) =>
    event.memberNumber === command.memberNumber;

const process: Command<MarkMemberRejoinedWithExistingNumber>['process'] =
  input =>
    pipe(
      input.events,
      RA.filter(isEventOfType('MemberRejoinedWithExistingNumber')),
      events =>
        RA.some(isDuplicateOfPreviousCommand(input.command))(events)
          ? O.none
          : O.some(
              constructEvent('MemberRejoinedWithExistingNumber')(input.command)
            )
    );

const resource: Command<MarkMemberRejoinedWithExistingNumber>['resource'] =
  input => ({
    type: 'Member',
    id: input.memberNumber.toString(),
  });

export const markMemberRejoinedWithExistingNumber: Command<MarkMemberRejoinedWithExistingNumber> =
  {
    process,
    resource,
    decode: codec.decode,
    isAuthorized: isAdminOrSuperUser,
  };
