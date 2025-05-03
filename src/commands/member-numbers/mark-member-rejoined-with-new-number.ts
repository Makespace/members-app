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
  oldMemberNumber: tt.IntFromString,
  newMemberNumber: tt.IntFromString,
});

export type MarkMemberRejoinedWithNewNumber = t.TypeOf<typeof codec>;

const isDuplicateOfPreviousCommand =
  (command: MarkMemberRejoinedWithNewNumber) =>
  (event: EventOfType<'MemberRejoinedWithNewNumber'>) =>
    event.oldMemberNumber === command.oldMemberNumber &&
    event.newMemberNumber === command.newMemberNumber;

const process: Command<MarkMemberRejoinedWithNewNumber>['process'] = input =>
  pipe(
    input.events,
    RA.filter(isEventOfType('MemberRejoinedWithNewNumber')),
    events =>
      RA.some(isDuplicateOfPreviousCommand(input.command))(events)
        ? O.none
        : O.some(constructEvent('MemberRejoinedWithNewNumber')(input.command))
  );

const resource: Command<MarkMemberRejoinedWithNewNumber>['resource'] =
  input => ({
    type: 'Member',
    id: input.oldMemberNumber.toString(),
  });

export const markMemberRejoinedWithNewNumber: Command<MarkMemberRejoinedWithNewNumber> =
  {
    process,
    resource,
    decode: codec.decode,
    isAuthorized: isAdminOrSuperUser,
  };
