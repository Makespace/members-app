import express, {Application} from 'express';
import {connectAllPubSubSubscribers} from './pubsub-subscribers';
import {createRouter} from './router';
import {createAdapters} from './adapters';
import passport from 'passport';
import session from 'cookie-session';
import httpLogger from 'pino-http';
import {loadConfig} from './configuration';
import {magicLink} from './authentication';
import {createTerminus} from '@godaddy/terminus';
import http from 'http';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {QueryDatabase, initQueryDatabase} from './adapters/query-database';

// Dependencies and Config
const conf = loadConfig();
const queryDatabase = initQueryDatabase(conf);
const deps = createAdapters(conf, queryDatabase);

// Authentication
passport.use(magicLink.name, magicLink.strategy(deps, conf));
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

// Application setup
const app: Application = express();
app.use(httpLogger({logger: deps.logger}));
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  session({
    secret: conf.SESSION_SECRET,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'strict',
    httpOnly: true,
    secure: conf.PUBLIC_URL.startsWith('https://'),
  })
);
app.set('trust proxy', true);
app.use(createRouter(deps, conf));
connectAllPubSubSubscribers(deps, conf);

// Start application
if (conf.PUBLIC_URL.includes('localhost')) {
  process.stdout.write(`
################################################################################

Makespace member management app starting

Visit ${conf.PUBLIC_URL} to see the application
Visit http://localhost:1080 to see the emails it sends

################################################################################
`);
}

const server = http.createServer(app);
createTerminus(server);

const ensureEventTableExists = (queryDatabase: QueryDatabase) =>
  queryDatabase(
    `
    CREATE TABLE IF NOT EXISTS events (
      id varchar(255),
      resource_id varchar(255),
      resource_type varchar(255),
      event_type varchar(255),
      payload json
    );
  `,
    []
  );

void pipe(
  ensureEventTableExists(queryDatabase),
  TE.mapLeft(e => deps.logger.error(e, 'Failed to start server')),
  TE.map(() =>
    server.listen(conf.PORT, () =>
      deps.logger.info({port: conf.PORT}, 'Server listening')
    )
  )
)();
