import express, {Application} from 'express';
import {createRouter} from './http';
import passport from 'passport';
import httpLogger from 'pino-http';
import {loadConfig} from './configuration';
import {
  cookieSessionPassportWorkaround,
  magicLink,
  sessionConfig,
  startMagicLinkEmailPubSub,
} from './authentication';
import {createTerminus} from '@godaddy/terminus';
import http from 'http';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {ensureEventTableExists} from './init-dependencies/event-store/ensure-event-table-exists';
import {initDependencies} from './init-dependencies';
import * as libsqlClient from '@libsql/client';
import cookieSession from 'cookie-session';
import {initRoutes} from './routes';

// Dependencies and Config
const conf = loadConfig();
const dbClient = libsqlClient.createClient({url: conf.EVENT_DB_URL});
const deps = initDependencies(dbClient, conf);
const routes = initRoutes(deps, conf);

// Passport Setup
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
app.use(cookieSession(sessionConfig(conf)));
app.use(cookieSessionPassportWorkaround);
app.set('trust proxy', true);
app.use(createRouter(routes));

// Start application
startMagicLinkEmailPubSub(deps, conf);
const server = http.createServer(app);
createTerminus(server);

void (async () => {
  await pipe(
    ensureEventTableExists(dbClient),
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
