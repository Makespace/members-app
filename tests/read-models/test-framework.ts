import createLogger from 'pino';
import * as T from 'fp-ts/Task';
import * as O from 'fp-ts/Option';
import {
  getAllEvents,
  getAllEventsByType,
} from '../../src/init-dependencies/event-store/get-all-events';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-events-table-exists';
import {DomainEvent} from '../../src/types';
import {pipe} from 'fp-ts/lib/function';
import {commands, Command} from '../../src/commands';
import {commitEvent} from '../../src/init-dependencies/event-store/commit-event';
import {arbitraryActor, getRightOrFail} from '../helpers';
import * as libsqlClient from '@libsql/client';
import {getResourceEvents} from '../../src/init-dependencies/event-store/get-resource-events';
import {EventName, EventOfType} from '../../src/types/domain-event';
import {Dependencies} from '../../src/dependencies';
import {applyToResource} from '../../src/commands/apply-command-to-resource';
import {initSharedReadModel} from '../../src/read-models/shared-state';
import {localGoogleHelpers} from '../init-dependencies/pull-local-google';
import {getCachedSheetData} from '../../src/init-dependencies/google/get-cached-sheet-data';
import {ensureCachedSheetDataTableExists} from '../../src/init-dependencies/google/ensure-cached-sheet-data-table-exists';
import {cacheSheetData} from '../../src/init-dependencies/google/cache-sheet-data';

type ToFrameworkCommands<T> = {
  [K in keyof T]: {
    [M in keyof T[K]]: T[K][M] extends {
      process: (input: {
        command: infer C;
        events: ReadonlyArray<DomainEvent>;
      }) => unknown;
    }
      ? (c: Omit<C, 'actor'>) => Promise<void>
      : never;
  };
};

export type TestFramework = {
  getAllEvents: () => Promise<ReadonlyArray<DomainEvent>>;
  getAllEventsByType: <T extends EventName>(
    eventType: T
  ) => Promise<ReadonlyArray<EventOfType<T>>>;
  commands: ToFrameworkCommands<typeof commands>;
  sharedReadModel: Dependencies['sharedReadModel'];
  depsForApplyToResource: {
    commitEvent: Dependencies['commitEvent'];
    getResourceEvents: Dependencies['getResourceEvents'];
  };
  eventStoreDb: libsqlClient.Client;
  getCachedSheetData: Dependencies['getCachedSheetData'];
};

export const initTestFramework = async (
  googleRateLimitMs: number = 120_000
): Promise<TestFramework> => {
  const logger = createLogger({level: 'silent'});
  const dbClient = libsqlClient.createClient({
    url: ':memory:',
  });
  const sharedReadModel = initSharedReadModel(
    dbClient,
    logger,
    O.some(localGoogleHelpers),
    googleRateLimitMs,
    O.none,
    cacheSheetData(dbClient),
    cacheSheetData(dbClient),
    O.none
  );
  const frameworkCommitEvent = commitEvent(
    dbClient,
    logger,
    sharedReadModel.asyncRefresh
  );
  getRightOrFail(await ensureEventTableExists(dbClient)());
  getRightOrFail(await ensureCachedSheetDataTableExists(dbClient)());
  const frameworkGetAllEvents = () =>
    pipe(getAllEvents(dbClient)(), T.map(getRightOrFail))();
  const frameworkGetAllEventsByType = <EN extends EventName>(eventType: EN) =>
    pipe(getAllEventsByType(dbClient)(eventType), T.map(getRightOrFail))();

  const frameworkify =
    <T>(command: Command<T>) =>
    async (commandPayload: T) => {
      await pipe(
        applyToResource(
          {
            commitEvent: frameworkCommitEvent,
            getResourceEvents: getResourceEvents(dbClient),
          },
          command
        )(commandPayload, arbitraryActor())
      )();
    };

  return {
    getAllEvents: frameworkGetAllEvents,
    getAllEventsByType: frameworkGetAllEventsByType,
    eventStoreDb: dbClient,
    sharedReadModel,
    depsForApplyToResource: {
      commitEvent: frameworkCommitEvent,
      getResourceEvents: getResourceEvents(dbClient),
    },
    getCachedSheetData: getCachedSheetData(dbClient),
    commands: {
      area: {
        create: frameworkify(commands.area.create),
        remove: frameworkify(commands.area.remove),
        addOwner: frameworkify(commands.area.addOwner),
        removeOwner: frameworkify(commands.area.removeOwner),
      },
      equipment: {
        add: frameworkify(commands.equipment.add),
        trainingSheet: frameworkify(commands.equipment.trainingSheet),
      },
      trainers: {
        add: frameworkify(commands.trainers.add),
        markTrained: frameworkify(commands.trainers.markTrained),
        revokeTrained: frameworkify(commands.trainers.revokeTrained),
      },
      members: {
        editName: frameworkify(commands.members.editName),
        editFormOfAddress: frameworkify(commands.members.editFormOfAddress),
        signOwnerAgreement: frameworkify(commands.members.signOwnerAgreement),
        editEmail: frameworkify(commands.members.editEmail),
      },
      memberNumbers: {
        linkNumberToEmail: frameworkify(
          commands.memberNumbers.linkNumberToEmail
        ),
        markMemberRejoined: frameworkify(
          commands.memberNumbers.markMemberRejoined
        ),
      },
      superUser: {
        declare: frameworkify(commands.superUser.declare),
        revoke: frameworkify(commands.superUser.revoke),
      },
    },
  };
};
