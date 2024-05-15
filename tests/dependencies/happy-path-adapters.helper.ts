import {Dependencies} from '../../src/dependencies';
import * as TE from 'fp-ts/TaskEither';
import {Logger} from 'pino';
import {StatusCodes} from 'http-status-codes';

export const happyPathAdapters: Dependencies = {
  commitEvent: () => () =>
    TE.right({status: StatusCodes.CREATED, message: 'dummy create event'}),
  getAllEvents: () => TE.right([]),
  logger: (() => undefined) as never as Logger,
  rateLimitSendingOfEmails: TE.right,
  sendEmail: () => TE.right('success'),
};
