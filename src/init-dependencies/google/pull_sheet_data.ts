import {Axios} from 'axios';
import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import {Failure} from '../../types';
import {GoogleSheetData} from '../../types/google';
import {notImplemented} from '../../not_implemented';

export const pullGoogleSheetData =
  (axios: Axios) =>
  (
    logger: Logger,
    trainingSheetId: string
  ): TE.TaskEither<Failure, GoogleSheetData> => {
    return notImplemented([axios, logger, trainingSheetId]);
  };
