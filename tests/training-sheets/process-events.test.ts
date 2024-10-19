import {UUID} from 'io-ts-types';
import {
  DomainEvent,
  EventOfType,
  isEventOfType,
} from '../../src/types/domain-event';
import pino from 'pino';
import * as RA from 'fp-ts/lib/ReadonlyArray';
import * as N from 'fp-ts/number';
import * as O from 'fp-ts/Option';
import * as gsheetData from '../data/google_sheet_data';
import {
  EquipmentWithLastQuizResult,
  pullNewEquipmentQuizResults,
} from '../../src/read-models/shared-state/async-apply-external-event-sources';
import {EpochTimestampMilliseconds} from '../../src/read-models/shared-state/return-types';
import {localGoogleHelpers} from '../init-dependencies/pull-local-google';

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
  equipment: EquipmentWithLastQuizResult
) => {
  const newEvents: DomainEvent[] = [];
  await pullNewEquipmentQuizResults(
    pino({
      level: 'fatal',
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
    localGoogleHelpers,
    equipment,
    newEvent => {
      newEvents.push(newEvent);
    }
  );
  return newEvents;
};

const defaultEquipment = (): EquipmentWithLastQuizResult => ({
  id: 'ebedee32-49f4-4d36-a350-4fa7848792bf' as UUID,
  name: 'Metal Lathe',
  areaId: 'f9cee7aa-75c6-42cc-8585-0e658044fe8e' as UUID,
  trainingSheetId: O.none,
  lastQuizResult: O.none,
  lastQuizSync: O.none,
});

type EquipmentQuizResultEvents = {
  quizResults: ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>;
  quizSync: ReadonlyArray<EventOfType<'EquipmentTrainingQuizSync'>>;
  startTime: Date;
  endTime: Date;
};
const pullEquipmentQuizResultsWrapper = async (
  spreadsheetId: O.Option<string>,
  lastQuizResult: O.Option<EpochTimestampMilliseconds> = O.none
): Promise<EquipmentQuizResultEvents> => {
  const equipment = defaultEquipment();
  equipment.trainingSheetId = spreadsheetId;
  equipment.lastQuizResult = lastQuizResult;
  const startTime = new Date();
  const events = await pullNewEquipmentQuizResultsLocal(equipment);
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
      it('Equipment with no training sheet', async () => {
        const result = await pullEquipmentQuizResultsWrapper(O.none);
        expect(result.quizResults).toHaveLength(0);
        expect(result.quizSync).toHaveLength(0);
      });

      it('empty sheet produces no events, but does indicate a sync', async () => {
        const result = await pullEquipmentQuizResultsWrapper(
          O.some(gsheetData.EMPTY.apiResp.spreadsheetId!)
        );
        expect(result.quizResults).toHaveLength(0);
        checkQuizSync(result);
      });
      it('metal lathe training sheet', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          O.some(gsheetData.METAL_LATHE.apiResp.spreadsheetId!)
        );
        checkQuizSync(results);
        expect(results.quizResults[0]).toMatchObject<
          Partial<EventOfType<'EquipmentTrainingQuizResult'>>
        >({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: defaultEquipment().id,
          trainingSheetId: gsheetData.METAL_LATHE.apiResp.spreadsheetId!,
          ...gsheetData.METAL_LATHE.entries[0],
        });
      });
      it('training sheet with a summary page', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          O.some(gsheetData.LASER_CUTTER.apiResp.spreadsheetId!)
        );
        checkQuizSync(results);
        const expected: readonly Partial<
          EventOfType<'EquipmentTrainingQuizResult'>
        >[] = gsheetData.LASER_CUTTER.entries.map(e => ({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: defaultEquipment().id,
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
          O.some(gsheetData.BAMBU.apiResp.spreadsheetId!)
        );
        checkQuizSync(results);
        const expected: readonly Partial<
          EventOfType<'EquipmentTrainingQuizResult'>
        >[] = gsheetData.BAMBU.entries.map(e => ({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: defaultEquipment().id,
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
      it('Only take new rows, date in future', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          O.some(gsheetData.BAMBU.apiResp.spreadsheetId!),
          O.some(Date.now() as EpochTimestampMilliseconds)
        );
        checkQuizSync(results);
        expect(results.quizResults).toHaveLength(0);
      });
      it('Only take new rows, date in far past', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          O.some(gsheetData.BAMBU.apiResp.spreadsheetId!),
          O.some(0 as EpochTimestampMilliseconds)
        );
        checkQuizSync(results);
        expect(results.quizResults).toHaveLength(
          gsheetData.BAMBU.entries.length
        );
      });

      // The quiz results have dates:
      // 1700768963 Thursday, November 23, 2023 7:49:23 PM
      // 1700769348 Thursday, November 23, 2023 7:55:48 PM
      // 1710249052 Tuesday, March 12, 2024 1:10:52 PM
      // 1710249842 Tuesday, March 12, 2024 1:24:02 PM

      it('Only take new rows, exclude 1', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          O.some(gsheetData.BAMBU.apiResp.spreadsheetId!),
          O.some(1700768963_000 as EpochTimestampMilliseconds)
        );
        checkQuizSync(results);
        expect(results.quizResults).toHaveLength(3);
      });

      it('Only take new rows, exclude 2', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          O.some(gsheetData.BAMBU.apiResp.spreadsheetId!),
          O.some(1700769348_000 as EpochTimestampMilliseconds)
        );
        checkQuizSync(results);
        expect(results.quizResults).toHaveLength(2);
      });

      it('Only take new rows, exclude 3', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          O.some(gsheetData.BAMBU.apiResp.spreadsheetId!),
          O.some(1710249052_000 as EpochTimestampMilliseconds)
        );
        checkQuizSync(results);
        expect(results.quizResults).toHaveLength(1);
      });

      it('Only take new rows, exclude all (already have latest)', async () => {
        const results = await pullEquipmentQuizResultsWrapper(
          O.some(gsheetData.BAMBU.apiResp.spreadsheetId!),
          O.some(1710249842_000 as EpochTimestampMilliseconds)
        );
        checkQuizSync(results);
        expect(results.quizResults).toHaveLength(0);
      });
    });
  });
});
