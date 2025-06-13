import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {SyncWorkerDependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {getAllEventsByTypes} from '../../init-dependencies/event-store/get-all-events';
import {EventOfType} from '../../types/domain-event';
import {UUID} from 'io-ts-types';

const accumTrainingSheet = (
  events: ReadonlyArray<
    | EventOfType<'EquipmentTrainingSheetRegistered'>
    | EventOfType<'EquipmentTrainingSheetRemoved'>
  >
): ReadonlyMap<UUID, string> => {
  const equipmentToSync = new Map<UUID, string>();
  for (const event of events) {
    if (event.type === 'EquipmentTrainingSheetRegistered') {
      equipmentToSync.set(event.equipmentId, event.trainingSheetId);
    } else {
      equipmentToSync.delete(event.equipmentId);
    }
  }
  return equipmentToSync;
};

export const getSheetsToSync =
  (db: Client): SyncWorkerDependencies['getSheetsToSync'] =>
  () =>
    pipe(
      getAllEventsByTypes(db)(
        'EquipmentTrainingSheetRegistered',
        'EquipmentTrainingSheetRemoved'
      ),
      TE.mapLeft(e => e.message),
      TE.map(accumTrainingSheet)
    );
