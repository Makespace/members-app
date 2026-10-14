import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {constructEvent} from '../../types';
import {Command, WithActor} from '../command';
import {isAdminSuperUserOrTrainerOrOwnerForEquipment} from '../authentication-helpers/is-admin-or-super-user-or-owner-trainer';
import {learnPointsText} from '../../types/learn-points';

const codec = t.strict({
  equipmentId: tt.UUID,
  learnPoints: learnPointsText,
});

type SetLearnPoints = t.TypeOf<typeof codec>;

const process = (input: {command: WithActor<SetLearnPoints>}) =>
  TE.right(O.some(constructEvent('EquipmentLearnPointsSet')(input.command)));

// The same people who can record the machine's guide: what to learn from it
// is theirs to say.
export const setLearnPoints: Command<SetLearnPoints> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrTrainerOrOwnerForEquipment,
};
