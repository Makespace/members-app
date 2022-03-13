import {pipe} from 'fp-ts/lib/function';
import {sendMemberNumberToEmail} from './send-member-number-to-email';
import PubSub from 'pubsub-js';
import * as TE from 'fp-ts/TaskEither';
import {Logger} from 'pino';
import {sendEmail} from '../adapters/send-email';

const adapters = {
  sendEmail: sendEmail(),
  getMemberNumberForEmail: () =>
    TE.left('getMemberNumberForEmail not implemented'),
};

export const connectAllPubSubSubscribers = (logger: Logger) => {
  PubSub.subscribe(
    'send-member-number-to-email',
    async (topic, email) =>
      await pipe(
        sendMemberNumberToEmail(adapters)(email),
        TE.match(
          errMsg =>
            logger.error({topic, error: errMsg}, 'Failed to process message'),
          successMsg => logger.debug({topic, result: successMsg})
        )
      )()
  );
};
