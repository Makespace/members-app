import {Dependencies} from '../../src/dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {Logger} from 'pino';
import {StatusCodes} from 'http-status-codes';
import {faker} from '@faker-js/faker';
import {EventName} from '../../src/types/domain-event';
import Database from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';

export const happyPathAdapters: Dependencies = {
  commitEvent: () => () =>
    TE.right({status: StatusCodes.CREATED, message: 'dummy create event'}),
  getAllEvents: () => TE.right([]),
  getResourceEvents: () => TE.right({events: [], version: faker.number.int()}),
  sharedReadModel: drizzle(new Database(':memory:')),
  logger: (() => undefined) as never as Logger,
  rateLimitSendingOfEmails: TE.right,
  sendEmail: () => TE.right('success'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAllEventsByType: <T extends EventName>(_eventType: T) => TE.right([]),
  updateTrainingQuizResults: O.none,
  lastTrainingQuizResultRefresh: O.none,
  trainingQuizRefreshRunning: false,
};
