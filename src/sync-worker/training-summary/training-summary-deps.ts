import {Config} from '../../configuration';
import {SyncWorkerDependencies} from '../dependencies';

export type TrainingSummaryDeps = Pick<
  SyncWorkerDependencies,
  | 'sendEmail'
  | 'sharedReadModel'
  | 'logger'
  | 'commitEvent'
  | 'lastQuizSync'
  | 'getSheetData'
  | 'getResourceEvents'
  | 'extDB'
> & {
  conf: Pick<Config, 'PUBLIC_URL'>;
};
