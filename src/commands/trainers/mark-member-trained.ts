import {DomainEvent, constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command, WithActor} from '../command';
import { isAdminSuperUserOrTrainerForEquipment } from '../authentication-helpers/is-admin-or-super-user-or-trainer';

const codec = t.strict({
  equipmentId: tt.UUID,
  memberNumber: t.union([t.Int, tt.IntFromString]),
});

export type MarkMemberTrained = t.TypeOf<typeof codec>;

const process = (input: {
  command: WithActor<MarkMemberTrained>;
  events: ReadonlyArray<DomainEvent>;
}) =>
  TE.right(
    O.some(
      constructEvent('MemberTrainedOnEquipment')({
        trainedByMemberNumber:
          input.command.actor.tag === 'user'
            ? input.command.actor.user.memberNumber
            : null, // We may want to handle 'system' members added differently or prevent this entirely for auditing purposes.
        equipmentId: input.command.equipmentId,
        memberNumber: input.command.memberNumber,
        legacyImport: false,
        actor: input.command.actor,
      })
    )
  );

const resource = (command: MarkMemberTrained) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

export const markMemberTrained: Command<MarkMemberTrained> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrTrainerForEquipment,
};
