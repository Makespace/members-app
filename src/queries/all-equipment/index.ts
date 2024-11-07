import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {Query} from '../query';
import {HttpResponse} from '../../types';
import {eq} from 'drizzle-orm';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  areasTable,
  equipmentTable,
  membersTable,
  ownersTable,
} from '../../read-models/shared-state/state';
import {ViewModel} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';

const getAreas = (db: SharedReadModel['db']): ViewModel['areas'] => {
  return pipe(
    db.select().from(areasTable).all(),
    RA.map(area => ({
      ...area,
      equipment: db
        .select()
        .from(equipmentTable)
        .where(eq(equipmentTable.areaId, area.id))
        .all(),
      owners: db
        .select({
          name: membersTable.name,
          memberNumber: membersTable.memberNumber,
          email: membersTable.emailAddress,
          agreementSignedAt: membersTable.agreementSigned,
        })
        .from(ownersTable)
        .innerJoin(
          membersTable,
          eq(membersTable.memberNumber, ownersTable.memberNumber)
        )
        .where(eq(ownersTable.areaId, area.id))
        .all(),
    }))
  );
};
export const allEquipment: Query = deps => user =>
  pipe(
    {user},
    TE.of,
    TE.let('areas', () => getAreas(deps.sharedReadModel.db)),
    TE.map(render),
    TE.map(rendered => HttpResponse.mk.CompleteHtmlPage({rendered}))
  );
