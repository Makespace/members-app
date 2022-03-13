import {pipe} from 'fp-ts/lib/function';
import {sendMemberNumberToEmail} from './send-member-number-to-email';
import PubSub from 'pubsub-js';
import * as TE from 'fp-ts/TaskEither';

const adapters = {
  sendMemberNumberEmail: () => TE.left('sendMemberNumberEmail not implemented'),
  getMemberNumberForEmail: () =>
    TE.left('getMemberNumberForEmail not implemented'),
};

export const subscribeAll = () => {
  PubSub.subscribe(
    'send-member-number-to-email',
    async (msg, email) =>
      await pipe(
        sendMemberNumberToEmail(adapters)(email),
        TE.match(
          errMsg =>
            console.log(
              `Failed to process message. topic: ${msg} error: ${errMsg}`
            ),
          successMsg =>
            console.log(
              `Processed message. topic: ${msg} result: ${successMsg}`
            )
        )
      )()
  );
};
