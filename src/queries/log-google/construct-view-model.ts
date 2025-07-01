import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {ViewModel} from './view-model';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {SheetDataTable} from '../../sync-worker/google/sheet-data-table';

export const constructViewModel =
  (deps: Pick<Dependencies, 'getSheetData' | 'sharedReadModel'>) =>
  (user: User) =>
  async (): Promise<E.Either<FailureWithStatus, ViewModel>> => {
    const requestUser = deps.sharedReadModel.members.get(user.memberNumber);
    if (O.isNone(requestUser) || !requestUser.value.isSuperUser) {
      return E.left(
        failureWithStatus(
          'You do not have the necessary permission to see this page.',
          StatusCodes.FORBIDDEN
        )()
      );
    }
    const result: Record<string, SheetDataTable['rows'] | null> = {};
    for (const equipment of deps.sharedReadModel.equipment.getAll()) {
      if (O.isNone(equipment.trainingSheetId)) {
        continue;
      }
      const x = await deps.getSheetData(
        equipment.trainingSheetId.value,
        O.none
      )();
      if (E.isRight(x)) {
        result[equipment.name] = x.right;
      } else {
        result[equipment.name] = null;
      }
    }
    return E.right({
      data: JSON.stringify(result),
    });
  };
