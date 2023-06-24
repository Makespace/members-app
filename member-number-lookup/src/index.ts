import express, {Application} from 'express';
import createLogger from 'pino';
import {connectAllPubSubSubscribers} from './pubsub-subscribers';
import {createRouter} from './router';

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

app.use(createRouter());

connectAllPubSubSubscribers(logger);

app.listen(port, () => logger.info({port}, 'Server listening'));
