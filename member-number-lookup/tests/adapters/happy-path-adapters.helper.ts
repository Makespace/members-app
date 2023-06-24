import faker from '@faker-js/faker';
import {Dependencies} from '../../src/dependencies';
import * as TE from 'fp-ts/TaskEither';
import {Logger} from 'pino';

export const happyPathAdapters: Dependencies = {
  getMemberNumber: () => TE.right(faker.datatype.number()),
  logger: (() => undefined) as never as Logger,
  rateLimitSendingOfEmails: TE.right,
  sendEmail: () => TE.right('success'),
};
