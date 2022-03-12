import express, {Application, Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import path from 'path';
import {checkYourMailPage} from './check-your-mail-page';
import {invalidEmailPage} from './invalid-email-page';
import {landingPage} from './landing-page';
import * as E from 'fp-ts/Either';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import PubSub from 'pubsub-js';
import {sendMemberNumberToEmail} from './send-member-number-to-email';

const app: Application = express();
const port = 8080;

app.use(express.urlencoded({extended: true}));

app.get('/', (req: Request, res: Response) => {
  res.status(200).send(landingPage);
});

app.use('/static', express.static(path.resolve(__dirname, './static')));

const logData = (topic: PubSubJS.Message, data: string) => {
  console.log(`Received message. topic: '${String(topic)}' payload: ${data}`);
};

PubSub.subscribe('send-member-number-to-email', logData);
PubSub.subscribe('send-member-number-to-email', sendMemberNumberToEmail);

app.post(
  '/send-member-number-by-email',
  async (req: Request, res: Response) => {
    pipe(
      req.body,
      parseEmailAddressFromBody,
      E.matchW(
        () => res.status(400).send(invalidEmailPage),
        email => {
          PubSub.publish('send-member-number-to-email', JSON.stringify(email));
          res.status(200).send(checkYourMailPage(email));
        }
      )
    );
  }
);

app.listen(port, () =>
  process.stdout.write(`Server is listening on port ${port}!\n`)
);
