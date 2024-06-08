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
import { runForever } from './training-sheets/training-sheets-worker';

async function main() {
  // Dependencies and Config
  const conf = loadConfig();
  const dbClient = libsqlClient.createClient({url: conf.EVENT_DB_URL});
  const deps = initDependencies(dbClient, conf);
  const routes = initRoutes(deps, conf);

  await pipe(
    ensureEventTableExists(dbClient),
    TE.mapLeft(e => { deps.logger.error(e, 'Failed to start'); process.exit(1); })
  )();
  
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
  app.use(httpLogger({logger: deps.logger, useLevel: 'debug'}));
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
  
  // Background processes should write events with their results.
  // Background processes can call commands as needed.
  const backgroundProcess = runForever(deps);
  server.on('close', () => {
    clearInterval(backgroundProcess);
  });

  
  // Readmodels are used to get the current status of the background tasks via the
  // events that have been written.
  // There is no 'direct' communication between front-end and background tasks except
  // via the events. This makes things much easier to test and allows changes to happen
  // to the front/backend without having to update both.

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
}

main();
