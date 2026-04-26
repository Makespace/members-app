import {constructEvent} from '../../types';
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

export type RevokeMemberTrained = t.TypeOf<typeof codec>;

const process = (input: {
  command: WithActor<RevokeMemberTrained>;
}) =>
  TE.right(
    O.some(
      constructEvent('RevokeTrainedOnEquipment')({
        revokedByMemberNumber:
          input.command.actor.tag === 'user'
            ? input.command.actor.user.memberNumber
            : null, // We may want to handle 'system' members added differently or prevent this entirely for auditing purposes.
        equipmentId: input.command.equipmentId,
        memberNumber: input.command.memberNumber,
        actor: input.command.actor,
      })
    )
  );

export const revokeMemberTrained: Command<RevokeMemberTrained> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrTrainerForEquipment,
};
