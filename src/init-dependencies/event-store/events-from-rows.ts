import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as tt from 'io-ts-types';
import {EventsTable} from './events-table';
import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent} from '../../types';
import {Logger} from 'pino';
import * as O from 'fp-ts/Option';

const parseEventFromRow = (row: EventsTable['rows'][number]) =>
  pipe(
    row.payload,
    tt.JsonFromString.decode,
    E.chain(tt.JsonRecord.decode),
    E.map(payload => ({
      type: row.event_type,
      ...payload,
    })),
    E.map(DomainEvent.decode)
  );

export const eventsFromRows =
  (logger: Logger) =>
  (rows: EventsTable['rows']): ReadonlyArray<DomainEvent> =>
    pipe(
      rows,
      RA.map(parseEventFromRow),
      RA.filterMap(eventRow => {
        if (E.isLeft(eventRow)) {
          logger.debug(
            eventRow.left,
            'Failed to load event row as json from database. Skipped'
          );
          return O.none;
        }
        if (E.isLeft(eventRow.right)) {
          logger.debug(
            eventRow.right.left,
            'Failed to load event from database - invalid schema. Skipped'
          );
          return O.none;
        }
        return O.some(eventRow.right.right);
      })
    );
