import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {constructEvent} from '../../types';
import {Command, WithActor} from '../command';
import {isAdminSuperUserOrTrainerOrOwnerForEquipment} from '../authentication-helpers/is-admin-or-super-user-or-owner-trainer';
import {webUrlOrEmpty} from '../../types/web-url';

const codec = t.strict({
  equipmentId: tt.UUID,
  guideUrl: webUrlOrEmpty('GuideUrl', 'guide url'),
});

type SetGuideUrl = t.TypeOf<typeof codec>;

const process = (input: {command: WithActor<SetGuideUrl>}) =>
  TE.right(O.some(constructEvent('EquipmentGuideUrlSet')(input.command)));

export const setGuideUrl: Command<SetGuideUrl> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrTrainerOrOwnerForEquipment,
};
