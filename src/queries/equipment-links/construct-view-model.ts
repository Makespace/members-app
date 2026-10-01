import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {FailureWithStatus} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {mustBeSuperuser} from '../util';
import {EquipmentLinks, ViewModel} from './view-model';

export const constructViewModel =
  (
    deps: Pick<Dependencies, 'sharedReadModel'>,
    user: User
  ): TE.TaskEither<FailureWithStatus, ViewModel> =>
  async () => {
    const superUserCheck = await mustBeSuperuser(deps.sharedReadModel, user)();
    if (E.isLeft(superUserCheck)) {
      return superUserCheck;
    }

    // Retired machines need neither a guide nor an assessment, and listing
    // them would make the gaps look worse than they are.
    const equipment: EquipmentLinks[] = deps.sharedReadModel.equipment
      .getAll()
      .filter(item => O.isNone(item.removedAt))
      .map(item => ({
        id: item.id,
        name: item.name,
        areaName: item.area.name,
        guideUrl: item.guideUrl,
        riskAssessmentUrl: item.riskAssessmentUrl,
      }))
      .sort(
        (a, b) =>
          a.areaName.localeCompare(b.areaName, ['en-GB']) ||
          a.name.localeCompare(b.name, ['en-GB'])
      );

    const hasBoth = (item: EquipmentLinks) =>
      O.isSome(item.guideUrl) && O.isSome(item.riskAssessmentUrl);

    return E.right({
      missing: equipment.filter(item => !hasBoth(item)),
      complete: equipment.filter(hasBoth),
      total: equipment.length,
      withGuide: equipment.filter(item => O.isSome(item.guideUrl)).length,
      withRiskAssessment: equipment.filter(item =>
        O.isSome(item.riskAssessmentUrl)
      ).length,
    });
  };
