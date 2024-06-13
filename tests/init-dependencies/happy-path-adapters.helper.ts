import {readFile as readFileOriginal} from 'fs';

import {Dependencies} from '../../src/dependencies';
import * as TE from 'fp-ts/TaskEither';

import {Logger} from 'pino';
import {StatusCodes} from 'http-status-codes';
import {faker} from '@faker-js/faker';
import {Failure} from '../../src/types';
import {EventName} from '../../src/types/domain-event';
import {sheets_v4} from 'googleapis';
import {pipe} from 'fp-ts/lib/function';

const readFile = TE.taskify(readFileOriginal);

const TEST_EMPTY_SPREADSHEET_FILE =
  './tests/data/google_spreadsheets_empty.json';

export const happyPathAdapters: Dependencies = {
  commitEvent: () => () =>
    TE.right({status: StatusCodes.CREATED, message: 'dummy create event'}),
  getAllEvents: () => TE.right([]),
  getResourceEvents: () => TE.right({events: [], version: faker.number.int()}),
  logger: (() => undefined) as never as Logger,
  rateLimitSendingOfEmails: TE.right,
  sendEmail: () => TE.right('success'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAllEventsByType: <T extends EventName>(_eventType: T) => TE.right([]),
  pullGoogleSheetData: (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _logger: Logger,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _trainingSheetId: string
  ): TE.TaskEither<Failure, sheets_v4.Schema$Spreadsheet> => {
    return pipe(
      readFile(TEST_EMPTY_SPREADSHEET_FILE),
      TE.mapBoth(
        err => {
          return {
            message: `Failed to load test data from ${TEST_EMPTY_SPREADSHEET_FILE}`,
            payload: err,
          };
        },
        buf => JSON.parse(buf.toString('utf8')) as sheets_v4.Schema$Spreadsheet
      )
    );
  },
};
