import express, {Application, Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import path from 'path';
import * as E from 'fp-ts/Either';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import {
  landingPage,
  invalidEmailPage,
  checkYourMailPage,
  notFoundPage,
} from './pages';
import PubSub from 'pubsub-js';
import createLogger from 'pino';
import {connectAllPubSubSubscribers} from './pubsub-subscribers';

const app: Application = express();

const logger = createLogger({
  formatters: {
    level: label => {
      return {severity: label};
    },
  },
});

const port = parseInt(process.env.PORT ?? '8080');

app.use(express.urlencoded({extended: true}));

// ROUTES
app.get('/', (req: Request, res: Response) => {
  res.status(200).send(landingPage);
});

app.use('/static', express.static(path.resolve(__dirname, './static')));

app.post('/send-member-number-by-email', (req: Request, res: Response) => {
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
});

app.use((req, res) => {
  res.status(404).send(notFoundPage);
});

// START APPLICATION
connectAllPubSubSubscribers(logger);

app.listen(port, () => logger.info({port}, 'Server listening'));
