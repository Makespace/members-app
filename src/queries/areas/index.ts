import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {Query} from '../query';
import {HttpResponse} from '../../types';
import {SharedReadModel} from '../../read-models/shared-state';
import {ViewModel} from './view-model';
import {areasTable, ownersTable} from '../../read-models/shared-state/state';
import * as RA from 'fp-ts/ReadonlyArray';
import {eq} from 'drizzle-orm';

const getAreas = (db: SharedReadModel['db']): ViewModel['areas'] => {
  return pipe(
    db.select().from(areasTable).all(),
    RA.map(area => ({
      ...area,
      owners: db
        .select()
        .from(ownersTable)
        .where(eq(ownersTable.areaId, area.id))
        .all(),
    }))
  );
};

export const areas: Query = deps => user =>
  pipe(
    TE.Do,
    TE.let('user', () => user),
    TE.let('areas', () => getAreas(deps.sharedReadModel.db)),
    TE.map(render),
    TE.map(rendered => HttpResponse.mk.Page({rendered}))
  );
