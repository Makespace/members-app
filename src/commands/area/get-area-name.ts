import {eq} from 'drizzle-orm';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {SharedReadModel} from '../../read-models/shared-state';
import {areasTable} from '../../read-models/shared-state/state';
import {failureWithStatus} from '../../types/failure-with-status';
import * as E from 'fp-ts/Either';

export const getAreaName = (db: SharedReadModel['db'], areaId: string) =>
  pipe(
    db
      .select({areaName: areasTable.name})
      .from(areasTable)
      .where(eq(areasTable.id, areaId))
      .get(),
    result => result?.areaName,
    E.fromNullable(
      failureWithStatus(
        'The requested area does not exist',
        StatusCodes.NOT_FOUND
      )()
    )
  );
