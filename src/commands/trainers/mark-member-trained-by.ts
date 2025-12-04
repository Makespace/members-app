import {DomainEvent, constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command, WithActor} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {isEquipmentTrainer} from '../is-equipment-trainer';
import {Actor} from '../../types/actor';
import {DateTime} from 'luxon';

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
          actor: input.command.actor,
        })
      );

const resource = (command: MarkMemberTrainedBy) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

const isWithinOneMonth = (date: Date): boolean => {
  const oneMonthAgo = DateTime.now().minus({months: 1});
  return DateTime.fromJSDate(date) >= oneMonthAgo;
};

const isAllowedToMarkTrainedBy = (input: {
  actor: Actor;
  events: ReadonlyArray<DomainEvent>;
  input: MarkMemberTrainedBy;
}): boolean => {
  return (
    input.actor.tag === 'user' &&
    (isAdminOrSuperUser(input) ||
    (isEquipmentTrainer(input.input.equipmentId)(input.actor, input.events)
     && isWithinOneMonth(input.input.trainedAt)))
  )
};

export const markMemberTrainedBy: Command<MarkMemberTrainedBy> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAllowedToMarkTrainedBy,
};
