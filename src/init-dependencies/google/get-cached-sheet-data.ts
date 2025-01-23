import {Client} from '@libsql/client/.';
import {Dependencies} from '../../dependencies';
import { pipe } from 'fp-ts/lib/function';

export const getCachedSheetData =
  (dbClient: Client): Dependencies['getCachedSheetData'] =>
  () => {
    pipe(
        dbClient.execute("SELECT * FROM cachedSheetData"),

    )

  };

export const cacheSheetData = (dbClient: Client): Dependencies['cacheSheetData'] =>
    (data: ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>) => {
        pipe(
            dbClient.execute("INSERT INTO cachedSheetData (cache_timestamp, sheet_id, equipment_id, cached_data) VALUES ($s)")
        )
    };
