import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {Dependencies} from './dependencies';
import {Equipment} from './read-models/shared-state/return-types';
import {pipe} from 'fp-ts/lib/function';
import {TROUBLE_TICKET_RESPONSES_SHEET} from './read-models/shared-state/async-apply-external-event-sources';
import {
  FailureWithStatus,
  failureWithStatus,
} from './types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';

export const loadCachedSheetData =
  (
    getCachedSheetData: Dependencies['getCachedSheetData'],
    logger: Logger,
    updateState: Dependencies['sharedReadModel']['updateState']
  ) =>
  async (equipment: Equipment) => {
    // We only load cached training events for equipment we know about.
    const equipmentLogger = logger.child({
      section: 'loadCachedSheetData',
      equipment_name: equipment.name,
      equipment_id: equipment.id,
      equipment_training_sheet_id: O.getOrElse<string | null>(() => null)(
        equipment.trainingSheetId
      ),
    });
    if (O.isNone(equipment.trainingSheetId)) {
      // If a piece of equipment removes a training sheet we won't load cached events that came from that
      // training sheet even if the events were for the correct piece of equipment. This allows fixing mistakes
      // where the wrong training sheet is was used previously.
      equipmentLogger.info(
        'Equipment has no training sheet id - not loading any cached data'
      );
      return;
    }
    equipmentLogger.info('Loading cached sheet data for sheet');
    const cachedSheetData = await getCachedSheetData(
      equipment.trainingSheetId.value
    )();
    if (E.isLeft(cachedSheetData)) {
      // Potential pitfall here - transient db errors could produce large spikes in processing.
      // Tradeoff is that an error/bug in cached sheet data doesn't bring down the application.
      equipmentLogger.error(
        cachedSheetData.left,
        'Failed to load cached sheet data for sheet - skipping...'
      );
    } else {
      if (O.isNone(cachedSheetData.right)) {
        equipmentLogger.info('No cached events found');
        return;
      }
      const loadedData = cachedSheetData.right.value;
      const sheetDataLogger = equipmentLogger.child({
        sheet_block_cached_at: loadedData.cached_at.toISOString(),
      });
      if (E.isLeft(loadedData.cached_data)) {
        sheetDataLogger.info(
          'Failed to parse cached sheet data block cached, skipping...'
        );
      } else {
        sheetDataLogger.info(
          'Loaded %s events from cached sheet data block, loading into shared read model...',
          loadedData.cached_data.right.length
        );
        for (const cachedEvent of loadedData.cached_data.right) {
          // This filtering makes loading cache data more predictable by only loading equipment events for the piece of equipment that is being loaded
          // even if the sheet has previously generated events for other pieces of equipment.
          if (cachedEvent.equipmentId !== equipment.id) {
            sheetDataLogger.warn(
              'Skipping event within cached sheet data block due to equipment id mismatch (cached %s)',
              cachedEvent.equipmentId
            );
          } else {
            updateState(cachedEvent);
          }
        }
      }
    }
  };

export const loadCachedTroubleTicketData = (
  getCachedTroubleTicketData: Dependencies['getCachedTroubleTicketData'],
  updateState: Dependencies['sharedReadModel']['updateState']
): TE.TaskEither<FailureWithStatus, void> =>
  pipe(
    getCachedTroubleTicketData(TROUBLE_TICKET_RESPONSES_SHEET),
    TE.flatMap(cacheData =>
      pipe(
        cacheData,
        O.match(
          () =>
            TE.left(
              failureWithStatus(
                'No cached trouble data found',
                StatusCodes.NOT_FOUND
              )()
            ),
          dataValidation =>
            pipe(
              dataValidation.cached_data,
              E.match(
                errs =>
                  TE.left(
                    failureWithStatus(
                      `Cached trouble data is malformed: ${formatValidationErrors(errs).join(',')}`,
                      StatusCodes.BAD_REQUEST
                    )()
                  ),
                data => TE.right(data)
              )
            )
        )
      )
    ),
    TE.map(loadedData => {
      pipe(loadedData, RA.map(updateState));
    })
  );
