import pino, {Logger} from 'pino';
import * as RA from 'fp-ts/ReadonlyArray';
import * as N from 'fp-ts/number';
import {pullTroubleTicketResponses} from '../../src/read-models/shared-state/async-apply-external-event-sources';
import {localGoogleHelpers} from '../init-dependencies/pull-local-google';
import {EventOfType} from '../../src/types/domain-event';
import {GoogleSheetId} from '../../src/dependencies';
import {
  manualParsedTroubleTicketToEvent,
  TROUBLE_TICKETS_EXAMPLE,
} from '../data/google_sheet_data';

const pullTroubleTicketsLocal = async () => {
  const newEvents: EventOfType<'TroubleTicketResponseSubmitted'>[] = [];
  const cachedData: EventOfType<'TroubleTicketResponseSubmitted'>[] = [];
  await pullTroubleTicketResponses(
    pino({
      level: 'fatal',
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
    localGoogleHelpers,
    TROUBLE_TICKETS_EXAMPLE.apiResp.spreadsheetId!,
    newEvent => {
      newEvents.push(newEvent);
    },
    (
      _cacheTimestamp: Date,
      _sheetId: GoogleSheetId,
      _logger: Logger,
      data: ReadonlyArray<EventOfType<'TroubleTicketResponseSubmitted'>>
    ) => {
      cachedData.push(...data);
      return Promise.resolve();
    }
  );
  return {
    newEvents,
    cachedData,
  };
};

const sortTroubleTicketEvents = RA.sort<{response_submitted_epoch_ms: number}>({
  compare: (a, b) =>
    N.Ord.compare(a.response_submitted_epoch_ms, b.response_submitted_epoch_ms),
  equals: (a, b) =>
    N.Ord.equals(a.response_submitted_epoch_ms, b.response_submitted_epoch_ms),
});

describe('Trouble tickets', () => {
  describe('Process results', () => {
    it('Processes a registered trouble ticket sheet', async () => {
      const {newEvents, cachedData} = await pullTroubleTicketsLocal();
      expect(newEvents).toHaveLength(TROUBLE_TICKETS_EXAMPLE.entries.length);
      expect(cachedData).toStrictEqual(newEvents);
      const sortedActual = sortTroubleTicketEvents(newEvents);
      const sortedExpected = sortTroubleTicketEvents(
        TROUBLE_TICKETS_EXAMPLE.entries.map(manualParsedTroubleTicketToEvent)
      );
      for (const [actual, expected] of RA.zip(sortedActual, sortedExpected)) {
        expect(actual).toMatchObject<
          Partial<EventOfType<'TroubleTicketResponseSubmitted'>>
        >(expected);
      }
    });
  });
});
