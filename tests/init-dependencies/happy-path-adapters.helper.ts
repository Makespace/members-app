import {Dependencies} from '../../src/dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import pino, {Logger} from 'pino';
import {StatusCodes} from 'http-status-codes';
import {faker} from '@faker-js/faker';
import {EventName} from '../../src/types/domain-event';
import {initSharedReadModel} from '../../src/read-models/shared-state';
import * as libsqlClient from '@libsql/client';

export const happyPathAdapters: Dependencies = {
  commitEvent: () => () =>
    TE.right({status: StatusCodes.CREATED, message: 'dummy create event'}),
  getAllEvents: () => TE.right([]),
  getResourceEvents: () => TE.right({events: [], version: faker.number.int()}),
  sharedReadModel: initSharedReadModel(
    libsqlClient.createClient({url: ':memory:'}),
    pino({
      level: 'fatal',
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
    O.none
  ),
  logger: (() => undefined) as never as Logger,
  rateLimitSendingOfEmails: TE.right,
  sendEmail: () => TE.right('success'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAllEventsByType: <T extends EventName>(_eventType: T) => TE.right([]),
  lastQuizSync: (_sheetId: string) => TE.right(O.none),
  getSheetData: (_sheetId: string) => TE.right([]),
  getTroubleTicketData: () => TE.right(O.none),
};
