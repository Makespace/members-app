import {Dependencies} from '../../src/dependencies';
import * as TE from 'fp-ts/TaskEither';
import {Logger} from 'pino';
import {StatusCodes} from 'http-status-codes';
import {faker} from '@faker-js/faker';

export const happyPathAdapters: Dependencies = {
  commitEvent: () => () =>
    TE.right({status: StatusCodes.CREATED, message: 'dummy create event'}),
  getAllEvents: () => TE.right([]),
  getResourceEvents: () => TE.right({events: [], version: faker.number.int()}),
  logger: (() => undefined) as never as Logger,
  rateLimitSendingOfEmails: TE.right,
  sendEmail: () => TE.right('success'),
};
