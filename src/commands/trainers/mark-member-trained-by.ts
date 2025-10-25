import {DomainEvent, constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command, WithActor} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {Actor} from '../../types/actor';

const codec = t.strict({
  equipmentId: tt.UUID,
  trainedByMemberNumber: t.union([t.Int, tt.IntFromString]),
  trainedAt: tt.DateFromISOString,
  memberNumber: t.union([t.Int, tt.IntFromString]),
});

export type MarkMemberTrainedBy = t.TypeOf<typeof codec>;

const process = (input: {
  command: WithActor<MarkMemberTrainedBy>;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  input.command.actor.tag !== 'user'
    ? O.none
    : O.some(
        constructEvent('MemberTrainedOnEquipmentBy')({
          equipmentId: input.command.equipmentId,
          trainedByMemberNumber: input.command.trainedByMemberNumber,
          trainedAt: input.command.trainedAt,
          memberNumber: input.command.memberNumber,
          markedTrainedBy: input.command.actor.user.memberNumber,
        })
      );

const resource = (command: MarkMemberTrainedBy) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

const isAllowedToMarkTrainedBy = (input: {
  actor: Actor;
  events: ReadonlyArray<DomainEvent>;
}): boolean => isAdminOrSuperUser(input) && input.actor.tag === 'user';

export const markMemberTrainedBy: Command<MarkMemberTrainedBy> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAllowedToMarkTrainedBy,
};
