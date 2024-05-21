import express, {Application} from 'express';
import {createRouter} from './router';
import passport from 'passport';
import session from 'express-session';
import httpLogger from 'pino-http';
import {loadConfig} from './configuration';
import {magicLink, startMagicLinkEmailPubSub} from './authentication';
import {createTerminus} from '@godaddy/terminus';
import http from 'http';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {initQueryEventsDatabase} from './init-dependencies/event-store/init-query-events-database';
import {ensureEventTableExists} from './init-dependencies/event-store/ensure-event-table-exists';
import {initDependencies} from './init-dependencies';

// Dependencies and Config
const conf = loadConfig();
const queryEventsDatabase = initQueryEventsDatabase();
const deps = initDependencies(conf, queryEventsDatabase);

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
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      sameSite: 'strict',
      secure: conf.PUBLIC_URL.startsWith('https://'),
    },
  })
);
app.set('trust proxy', true);
app.use(createRouter(deps, conf));
startMagicLinkEmailPubSub(deps, conf);

// Start application
const server = http.createServer(app);
createTerminus(server);

void (async () => {
  await pipe(
    ensureEventTableExists(queryEventsDatabase),
    TE.mapLeft(e => deps.logger.error(e, 'Failed to start server'))
  )();

  server.listen(conf.PORT, () => {
    deps.logger.info({port: conf.PORT}, 'Server listening');
    if (conf.PUBLIC_URL.includes('localhost')) {
      deps.logger.info({}, `Visit ${conf.PUBLIC_URL} to see the application`);
      deps.logger.info(
        {},
        'Visit http://localhost:1080 to see the emails it sends'
      );
    }
  });
})();
