import {Logger} from 'pino';
import {pipe} from 'fp-ts/lib/function';
import {v4 as uuidv4} from 'uuid';
import {Client} from '@libsql/client';
import {DomainEvent, ResourceVersion} from '../../types';
import {Resource} from '../../types/resource';
import {dbExecute} from '../../util';

export const initialVersionNumber = 0;

const constructArgsForNewEventRow = (
  event: DomainEvent,
  resource: Resource,
  version: number
) =>
  pipe(event, ({type, ...payload}) => [
    uuidv4(),
    resource.id,
    resource.type,
    version,
    type,
    JSON.stringify(payload),
    resource.id,
    resource.type,
    version,
  ]);

const insertEventRow = `
    INSERT INTO events
    (id, event_index, resource_id, resource_type, resource_version, event_type, payload)
    SELECT
      ?,
      COALESCE((SELECT MAX(event_index) + 1 FROM events), 1),
      ?,
      ?,
      ?,
      ?,
      ?
    WHERE NOT EXISTS (
      SELECT * FROM events
      WHERE resource_id = ?
        AND resource_type = ?
        AND resource_version = ?
    );
  `;

export const insertEventWithOptimisticConcurrencyControl = async (
  event: DomainEvent,
  resource: Resource,
  lastKnownVersion: ResourceVersion,
  eventDB: Client,
  logger: Logger
): Promise<'raised-event' | 'last-known-version-out-of-date'> => {
  const newResourceVersion =
    lastKnownVersion === 'no-such-resource'
      ? initialVersionNumber
      : lastKnownVersion + 1;
  const result = await dbExecute(
    eventDB,
    insertEventRow,
    constructArgsForNewEventRow(event, resource, newResourceVersion)
  );
  logger.debug({rowsAffected: result.rowsAffected}, 'OCC insert result');
  return result.rowsAffected === 1
    ? 'raised-event'
    : 'last-known-version-out-of-date';
};
