import {pipe} from 'fp-ts/lib/function';
import {sendMemberNumberToEmail} from './send-member-number-to-email';
import PubSub from 'pubsub-js';
import * as TE from 'fp-ts/TaskEither';
import {Logger} from 'pino';
import {sendEmail, getMemberNumber} from '../adapters';

const adapters = {
  sendEmail: sendEmail(),
  getMemberNumber: getMemberNumber(),
};

export const connectAllPubSubSubscribers = (logger: Logger) => {
  PubSub.subscribe(
    'send-member-number-to-email',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (topic, email) =>
      await pipe(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        sendMemberNumberToEmail(adapters)(email),
        TE.match(
          failure =>
            logger.error({topic, failure}, 'Failed to process message'),
          successMsg => logger.info({topic, result: successMsg})
        )
      )()
  );
};
