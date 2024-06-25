import {DomainEvent, constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  equipmentId: tt.UUID,
  memberEmail: t.string,
});

type MarkMemberTrained = t.TypeOf<typeof codec>;

const process = (input: {
  command: MarkMemberTrained;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  // No idempotency check required here currently. If the training sheet already matches the current then we still record the duplicate event.
  O.some(constructEvent('MemberTrainedOnEquipment')(input.command));

const resource = (command: MarkMemberTrained) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

export const registerTrainingSheet: Command<MarkMemberTrained> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser, // TODO - isOwnerOnEquipment
};
