import express, {Application} from 'express';
import {connectAllPubSubSubscribers} from './pubsub-subscribers';
import {createRouter} from './router';
import {createAdapters} from './adapters';

const port = parseInt(process.env.PORT ?? '8080');

const deps = createAdapters();

const app: Application = express();

app.use(express.urlencoded({extended: true}));

app.use(createRouter());

connectAllPubSubSubscribers(deps);

app.listen(port, () => deps.logger.info({port}, 'Server listening'));
