import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as S from 'fp-ts/string';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {sequenceS} from 'fp-ts/lib/Apply';

import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {Logger} from 'pino';
import {Ord, contramap} from 'fp-ts/lib/Ord';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {accumBy, lastBy} from '../util';
import {QzEvent, QzEventDuplicate, RegEvent} from './events';
import {extractGoogleSheetData} from './google';

const byEquipmentId: Ord<RegEvent> = pipe(
  S.Ord,
  contramap((e: RegEvent) => e.equipmentId)
);

const getTrainingSheets = (events: ReadonlyArray<RegEvent>) =>
  pipe(
    events,
    RA.sortBy([byEquipmentId]),
    lastBy(event => event.equipmentId)
  );

const getPreviousQuizResultsByTrainingSheet = accumBy<string, QzEvent>(
  e => e.trainingSheetId
);

const processForEquipment = (
  logger: Logger,
  deps: Dependencies,
  regEvent: RegEvent,
  existingQuizResults: ReadonlyArray<QzEvent>
): TE.TaskEither<FailureWithStatus, ReadonlyArray<QzEvent>> => {
  logger.info(
    `Scanning training sheet ${regEvent.trainingSheetId}. Pulling google sheet data...`
  );
  // TODO - Check global rate limit. -> Maybe this should also be an event?

  return pipe(
    deps.pullGoogleSheetData(logger, regEvent.trainingSheetId),
    TE.flatMap(data => {
      logger.trace(
        "Received data from google sheets for training sheet '{regEvent.trainingSheetId}': '%o'",
        data
      );
      return TE.right(data);
    }),
    TE.mapLeft(
      failureWithStatus(
        'Failed to pull google sheet data',
        StatusCodes.INTERNAL_SERVER_ERROR
      )
    ),
    TE.chain(spreadsheet =>
      pipe(
        spreadsheet,
        extractGoogleSheetData(
          logger.child({trainingSheetId: regEvent.trainingSheetId}),
          regEvent.equipmentId,
          regEvent.trainingSheetId
        ),
        O.map(events => {
          // We could check for duplicate quiz results earlier but I doubt the performance difference will be
          // measurable.
          logger.info(
            `Found ${events.length} quiz result events, checking for ones we have already seen...`
          );
          const newQuizResults =
            RA.difference(QzEventDuplicate)(existingQuizResults)(events);
          logger.info(
            `${newQuizResults.length} new quiz results after filtering`
          );
          return newQuizResults;
        }),
        O.match(
          () =>
            TE.left(
              failureWithStatus(
                'Failed to extract google sheet data',
                StatusCodes.INTERNAL_SERVER_ERROR
              )()
            ),
          val => TE.right(val)
        )
      )
    )
  );
};

// FailureWithStatus probably isn't the type to be using as the 'error'.
const process =
  (logger: Logger, deps: Dependencies) =>
  (
    sheetRegEvents: ReadonlyArray<RegEvent>,
    existingQuizResultEvents: ReadonlyArray<QzEvent>
  ): TE.TaskEither<FailureWithStatus, ReadonlyArray<QzEvent>> => {
    logger.info(
      'Got %d existing events, getting training sheets...',
      existingQuizResultEvents.length
    );
    const trainingSheets = getTrainingSheets(sheetRegEvents);
    const previousQuizResults = getPreviousQuizResultsByTrainingSheet(
      existingQuizResultEvents
    );
    logger.info(
      `Got ${Object.keys(trainingSheets).length} training sheets to scan...`
    );
    return pipe(
      Object.entries(trainingSheets),
      RA.map(([equipmentId, sheet]) =>
        processForEquipment(
          logger.child({equipment: equipmentId}),
          deps,
          sheet,
          previousQuizResults[sheet.trainingSheetId] ?? RA.empty
        )
      ),
      TE.sequenceArray,
      TE.chain(entries => TE.right(RA.flatten(entries)))
    );
  };

export const run = async (
  deps: Dependencies,
  logger: Logger
): Promise<void> => {
  logger.info('Running training sheets worker job. Getting existing events...');
  const newEvents = await pipe(
    {
      equipmentEvents:
        deps.getAllEventsByType<'EquipmentTrainingSheetRegistered'>(
          'EquipmentTrainingSheetRegistered'
        ),
      equipmentQuizEvents:
        deps.getAllEventsByType<'EquipmentTrainingQuizResult'>(
          'EquipmentTrainingQuizResult'
        ),
    },
    sequenceS(TE.ApplySeq),
    TE.chain(({equipmentEvents, equipmentQuizEvents}) =>
      process(logger, deps)(equipmentEvents, equipmentQuizEvents)
    )
  )();

  if (E.isLeft(newEvents)) {
    logger.error(newEvents.left, 'Failed to get training quiz results');
    return;
  }
  logger.info(
    `Finished getting training sheet quiz results, gathered: ${newEvents.right.length} results. Committing...`
  );

  for (const newEvent of newEvents.right) {
    pipe(
      await deps.commitEvent(
        {
          type: 'EquipmentTrainingQuizResult',
          id: newEvent.id,
        },
        'no-such-resource'
      )(newEvent)(),
      E.fold(
        (err: FailureWithStatus) => logger.error(err),
        success => logger.debug(success)
      )
    );
  }
  logger.info('Finished commiting training sheet quiz results');
};

const runLogged = async (deps: Dependencies, logger: Logger) => {
  const start = performance.now();
  try {
    await run(deps, logger);
    logger.info(
      `Took ${Math.round(
        performance.now() - start
      )}ms to run training sheets worker job`
    );
  } catch (err) {
    logger.error(err, 'Unhandled error in training sheets worker');
  }
};

// I generally don't like this way of doing things and prefer an await loop
// but trying a different approach.
// TODO - Switch this to use an event-emitter so we can trigger background processing of specific training sheets at will.
export const runForever = (deps: Dependencies, conf: Config) => {
  const logger = deps.logger.child({section: 'training-sheets-worker'});
  void runLogged(deps, logger);
  logger.info(
    `Running forever with interval ${conf.BACKGROUND_PROCESSING_RUN_INTERVAL_MS}ms`
  );
  return setInterval(
    // TODO - Handle run still going when next run scheduled.
    () => void runLogged(deps, logger),
    conf.BACKGROUND_PROCESSING_RUN_INTERVAL_MS
  );
};
