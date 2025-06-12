import {UUID} from 'io-ts-types';
import {
  DomainEvent,
  EventOfType,
  isEventOfType,
} from '../../src/types/domain-event';
import pino from 'pino';
import * as RA from 'fp-ts/lib/ReadonlyArray';
import * as N from 'fp-ts/number';
import * as gsheetData from '../data/google_sheet_data';
import {localGoogleHelpers} from '../init-dependencies/pull-local-google';
import {pullNewEquipmentQuizResults} from '../../src/read-models/external-event-sources/google/training-sheet';
import {LastGoogleSheetRowRead} from '../../src/read-models/shared-state/return-types';

const sortQuizResults = RA.sort({
  compare: (a, b) =>
    N.Ord.compare(
      (a as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochMS,
      (b as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochMS
    ),
  equals: (a, b) =>
    N.Ord.equals(
      (a as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochMS,
      (b as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochMS
    ),
});

const pullNewEquipmentQuizResultsLocal = async (
  equipmentId: UUID,
  trainingSheetId: string,
  prevLastRowRead: LastGoogleSheetRowRead
) => {
  const newEvents: DomainEvent[] = [];
  await pullNewEquipmentQuizResults(
    pino({
      level: 'fatal',
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
    localGoogleHelpers,
    equipmentId,
    trainingSheetId,
    prevLastRowRead,
    newEvent => {
      newEvents.push(newEvent);
    }
  );
  return newEvents;
};

const TEST_EQUIPMENT_ID = 'ebedee32-49f4-4d36-a350-4fa7848792bf' as UUID;

type EquipmentQuizResultEvents = {
  quizResults: ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>;
  quizSync: ReadonlyArray<EventOfType<'EquipmentTrainingQuizSync'>>;
  startTime: Date;
  endTime: Date;
};
const pullEquipmentQuizResultsWrapper = async (
  spreadsheetId: string,
  prevLastRowRead: LastGoogleSheetRowRead
): Promise<EquipmentQuizResultEvents> => {
  const startTime = new Date();
  const events = await pullNewEquipmentQuizResultsLocal(
    TEST_EQUIPMENT_ID,
    spreadsheetId,
    prevLastRowRead
  );
  const endTime = new Date();
  const result = {
    quizResults: [] as EventOfType<'EquipmentTrainingQuizResult'>[],
    quizSync: [] as EventOfType<'EquipmentTrainingQuizSync'>[],
  };
  for (const event of events) {
    if (isEventOfType('EquipmentTrainingQuizResult')(event)) {
      result.quizResults.push(event);
    } else if (isEventOfType('EquipmentTrainingQuizSync')(event)) {
      result.quizSync.push(event);
    } else {
      throw new Error('Unexpected event type');
    }
  }
  return {
    ...result,
    startTime,
    endTime,
  };
};

const checkQuizSync = (results: EquipmentQuizResultEvents) => {
  expect(results.quizSync).toHaveLength(1);
  expect(results.quizSync[0].recordedAt.getTime()).toBeGreaterThanOrEqual(
    results.startTime.getTime()
  );
  expect(results.quizSync[0].recordedAt.getTime()).toBeLessThanOrEqual(
    results.endTime.getTime()
  );
};

describe('Training sheets worker', () => {
  describe('Process results', () => {
    describe('Processes a registered training sheet', () => {
      it('empty sheet produces no events, but does indicate a sync', async () => {
        const result = await pullEquipmentQuizResultsWrapper(
          gsheetData.EMPTY.apiResp.spreadsheetId!,
          {}
        );
        expect(result.quizResults).toHaveLength(0);
        checkQuizSync(result);
      });
      it('metal lathe training sheet', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          gsheetData.METAL_LATHE.apiResp.spreadsheetId!,
          {}
        );
        checkQuizSync(results);
        expect(results.quizResults[0]).toMatchObject<
          Partial<EventOfType<'EquipmentTrainingQuizResult'>>
        >({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: TEST_EQUIPMENT_ID,
          trainingSheetId: gsheetData.METAL_LATHE.apiResp.spreadsheetId!,
          ...gsheetData.METAL_LATHE.entries[0],
        });
      });
      it('training sheet with a summary page', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          gsheetData.LASER_CUTTER.apiResp.spreadsheetId!,
          {}
        );
        checkQuizSync(results);
        const expected: readonly Partial<
          EventOfType<'EquipmentTrainingQuizResult'>
        >[] = gsheetData.LASER_CUTTER.entries.map(e => ({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: TEST_EQUIPMENT_ID,
          trainingSheetId: gsheetData.LASER_CUTTER.apiResp.spreadsheetId!,
          actor: {
            tag: 'system',
          },
          ...e,
        }));
        expect(results.quizResults).toHaveLength(expected.length);

        for (const [actualEvent, expectedEvent] of RA.zip(
          sortQuizResults(results.quizResults),
          sortQuizResults(expected)
        )) {
          expect(actualEvent).toMatchObject<
            Partial<EventOfType<'EquipmentTrainingQuizResult'>>
          >(expectedEvent);
        }
      });
      it('training sheet with multiple response pages (different quiz questions)', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          gsheetData.BAMBU.apiResp.spreadsheetId!,
          {}
        );
        checkQuizSync(results);
        const expected: readonly Partial<
          EventOfType<'EquipmentTrainingQuizResult'>
        >[] = gsheetData.BAMBU.entries.map(e => ({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: TEST_EQUIPMENT_ID,
          trainingSheetId: gsheetData.BAMBU.apiResp.spreadsheetId!,
          actor: {
            tag: 'system',
          },
          ...e,
        }));
        expect(results.quizResults).toHaveLength(expected.length);

        for (const [actualEvent, expectedEvent] of RA.zip(
          sortQuizResults(results.quizResults),
          sortQuizResults(expected)
        )) {
          expect(actualEvent).toMatchObject<
            Partial<EventOfType<'EquipmentTrainingQuizResult'>>
          >(expectedEvent);
        }
      });
    });
  });
});
