import {faker} from '@faker-js/faker';
import {Dependencies} from '../../src/dependencies';
import * as TE from 'fp-ts/TaskEither';
import {Logger} from 'pino';

export const happyPathAdapters: Dependencies = {
  getMemberNumber: () => TE.right(faker.number.int()),
  getTrainers: () => TE.right([]),
  logger: (() => undefined) as never as Logger,
  rateLimitSendingOfEmails: TE.right,
  sendEmail: () => TE.right('success'),
};
