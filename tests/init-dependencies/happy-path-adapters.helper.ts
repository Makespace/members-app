import {Dependencies} from '../../src/dependencies';
import * as TE from 'fp-ts/TaskEither';
import {Logger} from 'pino';
import {StatusCodes} from 'http-status-codes';
import {faker} from '@faker-js/faker';
import {Failure} from '../../src/types';
import {EventName} from '../../src/types/domain-event';
import {GoogleSheetData} from '../../src/types/google';
import {notImplemented} from '../../src/not_implemented';

export const happyPathAdapters: Dependencies = {
  commitEvent: () => () =>
    TE.right({status: StatusCodes.CREATED, message: 'dummy create event'}),
  getAllEvents: () => TE.right([]),
  getResourceEvents: () => TE.right({events: [], version: faker.number.int()}),
  logger: (() => undefined) as never as Logger,
  rateLimitSendingOfEmails: TE.right,
  sendEmail: () => TE.right('success'),
  getAllEventsByType: <T extends EventName>(eventType: T) =>
    notImplemented([eventType]),
  pullGoogleSheetData: function (
    logger: Logger,
    trainingSheetId: string
  ): TE.TaskEither<Failure, GoogleSheetData> {
    return notImplemented([logger, trainingSheetId]);
  },
};
