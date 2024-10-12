import {Actor, DomainEvent, constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command, WithActor} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {isEquipmentTrainer} from '../is-equipment-trainer';

const codec = t.strict({
  equipmentId: tt.UUID,
  memberNumber: t.union([t.Int, tt.IntFromString]),
});

export type MarkMemberTrained = t.TypeOf<typeof codec>;

const process = (input: {
  command: WithActor<MarkMemberTrained>;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  O.some(
    constructEvent('MemberTrainedOnEquipment')({
      trainedByMemberNumber:
        input.command.actor.tag === 'user'
          ? input.command.actor.user.memberNumber
          : null, // We may want to handle 'system' members added differently or prevent this entirely for auditing purposes.
      equipmentId: input.command.equipmentId,
      memberNumber: input.command.memberNumber,
      legacyImport: false,
    })
  );

const resource = (command: MarkMemberTrained) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

const isAdminSuperUserOrTrainerForEquipment = (input: {
  actor: Actor;
  events: ReadonlyArray<DomainEvent>;
  input: MarkMemberTrained;
}) =>
  isAdminOrSuperUser(input) ||
  isEquipmentTrainer(input.input.equipmentId)(input.actor, input.events);

export const markMemberTrained: Command<MarkMemberTrained> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrTrainerForEquipment,
};
