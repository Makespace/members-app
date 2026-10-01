import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {constructEvent} from '../../types';
import {Command, WithActor} from '../command';
import {isAdminSuperUserOrOwnerForEquipment} from '../authentication-helpers/is-admin-super-user-or-owner';
import {webUrlOrEmpty} from '../../types/web-url';

const codec = t.strict({
  equipmentId: tt.UUID,
  riskAssessmentUrl: webUrlOrEmpty(
    'RiskAssessmentUrl',
    'risk assessment address'
  ),
});

type SetRiskAssessmentUrl = t.TypeOf<typeof codec>;

const process = (input: {command: WithActor<SetRiskAssessmentUrl>}) =>
  TE.right(
    O.some(constructEvent('EquipmentRiskAssessmentUrlSet')(input.command))
  );

export const setRiskAssessmentUrl: Command<SetRiskAssessmentUrl> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrOwnerForEquipment,
};
