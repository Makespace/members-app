import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import {PullSheetData} from '../../read-models/shared-state/async-apply-external-event-sources';
import {EventOfType} from '../../types/domain-event';
import {Failure} from '../../types';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';

export const pullLegacyTrainedMembers = (
  logger: Logger,
  currentState: BetterSQLite3Database,
  legacyTrainingSheetId: string,
  pullGoogleSheetData: PullSheetData
): TE.TaskEither<
  Failure,
  ReadonlyArray<EventOfType<'LegacyMemberTrainedOnEquipment'>>
> => {
  logger = logger.child({legacyTrainingSheetId});
  logger.info('Pulling trained members from legacy sheet...');
  return pipe(pullGoogleSheetData(logger, legacyTrainingSheetId));
};
