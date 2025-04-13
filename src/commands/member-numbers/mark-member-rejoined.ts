import * as RA from 'fp-ts/ReadonlyArray';
import {constructEvent, isEventOfType} from '../../types';
import * as t from 'io-ts';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {pipe} from 'fp-ts/lib/function';
import {EventOfType} from '../../types/domain-event';

const codec = t.strict({
  oldMembershipNumber: t.Integer,
  newMembershipNumber: t.Integer,
});

export type MarkMemberRejoined = t.TypeOf<typeof codec>;

const isDuplicateOfPreviousCommand =
  (command: MarkMemberRejoined) =>
  (event: EventOfType<'MemberRejoinedWithNewNumber'>) =>
    event.oldMembershipNumber === command.oldMembershipNumber &&
    event.newMembershipNumber === command.newMembershipNumber;

const process: Command<MarkMemberRejoined>['process'] = input =>
  pipe(
    input.events,
    RA.filter(isEventOfType('MemberRejoinedWithNewNumber')),
    events =>
      RA.some(isDuplicateOfPreviousCommand(input.command))(events)
        ? O.none
        : O.some(constructEvent('MemberRejoinedWithNewNumber')(input.command))
  );

const resource: Command<MarkMemberRejoined>['resource'] = input => ({
  type: 'Member',
  id: input.oldMembershipNumber.toString(),
});

export const markMemberRejoined: Command<MarkMemberRejoined> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
