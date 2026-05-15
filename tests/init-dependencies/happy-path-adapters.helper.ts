import {Dependencies} from '../../src/dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import pino, {Logger} from 'pino';
import {StatusCodes} from 'http-status-codes';
import {EventName} from '../../src/types/domain-event';
import {initSharedReadModel} from '../../src/read-models/shared-state';
import * as libsqlClient from '@libsql/client';
import { initExternalStateDB } from '../../src/sync-worker/external-state-db';
import { Int } from 'io-ts';

export const happyPathAdapters: Dependencies = {
  commitEvent: () => () => 
    TE.right({status: StatusCodes.CREATED, message: 'dummy create event'}),
  getAllEvents: () => TE.right([]),
  getDeletedEvents: () => TE.right([]),
  sharedReadModel: initSharedReadModel(
    libsqlClient.createClient({url: ':memory:'}),
    pino({
      level: 'fatal',
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
  ),
  extDB: initExternalStateDB(libsqlClient.createClient({url: ':memory:'})),
  logger: (() => undefined) as never as Logger,
  rateLimitSendingOfEmails: TE.right,
  sendEmail: () => TE.right('success'),
  getAllEventsByType: <T extends EventName>(_eventType: T) => TE.right([]),
  deleteEvent: (_eventIndex, _deleteReason, _markDeletedByMemberNumber) => TE.right(undefined),
  unDeleteEvent: (_eventIndex) => TE.right(undefined),
  lastQuizSync: (_sheetId: string) => TE.right(O.none),
  getSheetData: (_sheetId: string) => TE.right([]),
  getSheetDataByMemberNumber: (_memberNumber: number) => TE.right([]),
  getTroubleTicketData: () => TE.right(O.none),
  getEventByIndex: (_eventIndex: Int) => TE.right(O.none),
  getDeletedEventByIndex: (_eventIndex: Int) => TE.right(O.none),
};
