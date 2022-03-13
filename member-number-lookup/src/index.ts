import express, {Application, Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import path from 'path';
import * as E from 'fp-ts/Either';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import {landingPage, invalidEmailPage, checkYourMailPage} from './pages';
import {subscribeAll} from './pubsub-subscribers/subscribe-all';
import PubSub from 'pubsub-js';

const app: Application = express();
const port = 8080;
app.use(express.urlencoded({extended: true}));

// ROUTES
app.get('/', (req: Request, res: Response) => {
  res.status(200).send(landingPage);
});

app.use('/static', express.static(path.resolve(__dirname, './static')));

app.post(
  '/send-member-number-by-email',
  async (req: Request, res: Response) => {
    pipe(
      req.body,
      parseEmailAddressFromBody,
      E.matchW(
        () => res.status(400).send(invalidEmailPage),
        email => {
          PubSub.publish('send-member-number-to-email', email);
          res.status(200).send(checkYourMailPage(email));
        }
      )
    );
  }
);

// START APPLICATION
subscribeAll();

app.listen(port, () =>
  process.stdout.write(`Server is listening on port ${port}!\n`)
);
