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
import * as O from 'fp-ts/Option';
import {ensureEventTableExists} from './init-dependencies/event-store/ensure-events-table-exists';
import {initDependencies} from './init-dependencies';
import * as libsqlClient from '@libsql/client';
import cookieSession from 'cookie-session';
import {initRoutes} from './routes';
import {ensureCachedSheetDataTableExists} from './init-dependencies/google/ensure-cached-sheet-data-table-exists';
import {
  loadCachedSheetData,
  loadCachedTroubleTicketData,
} from './load-cached-sheet-data';
import {timeAsync} from './util';

// Dependencies and Config
const conf = loadConfig();
const dbClient = libsqlClient.createClient({
  url: conf.EVENT_DB_URL,
  syncUrl: conf.TURSO_SYNC_URL,
  authToken: conf.TURSO_TOKEN,
});
const cacheClient = libsqlClient.createClient({
  url: conf.EVENT_DB_URL,
  syncUrl: conf.TURSO_SYNC_URL,
  authToken: conf.TURSO_TOKEN,
});
const deps = initDependencies(dbClient, cacheClient, conf);
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
app.use(httpLogger({logger: deps.logger, useLevel: 'debug'}));
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(cookieSession(sessionConfig(conf)));
app.use(cookieSessionPassportWorkaround);
app.set('trust proxy', true);
app.use(createRouter(routes));

setInterval(() => {
  deps.logger.info('Heartbeat');
}, 5000);

// Start application
startMagicLinkEmailPubSub(deps, conf);
const server = http.createServer(app);
createTerminus(server);

const periodicReadModelRefresh = setInterval(() => {
  deps.sharedReadModel
    .asyncRefresh()()
    .then(() => deps.logger.debug('Refreshed read model'))
    .catch(err =>
      deps.logger.error(err, 'Unexpected error when refreshing read model')
    );
}, 10000);
const periodicExternalReadModelRefresh = setInterval(() => {
  deps.sharedReadModel
    .asyncApplyExternalEventSources()()
    .then(() =>
      deps.logger.info('Refreshed read model with external event sources')
    )
    .catch(err =>
      deps.logger.error(
        err,
        'Unexpected error when refreshing read model with external sources'
      )
    );
}, 60_000);
server.on('close', () => {
  clearInterval(periodicReadModelRefresh);
  clearInterval(periodicExternalReadModelRefresh);
});

// Readmodels are used to get the current status of the background tasks via the
// events that have been written.
// There is no 'direct' communication between front-end and background tasks except
// via the events. This makes things much easier to test and allows changes to happen
// to the front/backend without having to update both.

void (async () => {
  await pipe(
    ensureEventTableExists(dbClient),
    TE.map(ensureCachedSheetDataTableExists(dbClient)),
    TE.mapLeft(e => deps.logger.error(e, 'Failed to start server'))
  )();

  deps.logger.info('Populating shared read model...');
  await deps.sharedReadModel.asyncRefresh()(); // We refresh before we load cached sheet data so we know what sheets to load cached data from.
  deps.logger.info('Loading cached external events...');
  await timeAsync(elapsedNs =>
    deps.logger.info(
      'Loaded cached external events in %sms',
      elapsedNs / (1000 * 1000)
    )
  )(
    Promise.all(
      deps.sharedReadModel.equipment
        .getAll()
        .map(
          loadCachedSheetData(
            deps.getCachedSheetData,
            deps.logger,
            deps.sharedReadModel.updateState
          )
        )
    )
  );
  for (const equipment of deps.sharedReadModel.equipment.getAll()) {
    deps.logger.info(
      'After loading cached external events the last quiz sync for equipment %s (%s) was %s (epoch ms)',
      equipment.name,
      equipment.id,
      O.getOrElse<string | number>(() => 'never')(equipment.lastQuizSync)
    );
  }

  if (conf.TROUBLE_TICKET_SHEET) {
    await timeAsync(elapsedNs =>
      deps.logger.info(
        'Loaded cached trouble ticket events in %sms',
        elapsedNs / (1000 * 1000)
      )
    )(
      Promise.all([
        pipe(
          loadCachedTroubleTicketData(
            conf.TROUBLE_TICKET_SHEET,
            deps.getCachedTroubleTicketData,
            deps.sharedReadModel.updateState
          ),
          TE.match(
            failure => {
              deps.logger.warn(
                'Failed to load cached trouble ticket data - continuing anyway: %s',
                failure.message
              );
            },
            _ => {}
          )
        )(),
      ])
    );
  } else {
    deps.logger.warn(
      'No trouble ticket sheet provided - skipping loading cache data'
    );
  }

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
