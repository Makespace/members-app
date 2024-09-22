import createLogger from 'pino';
import * as T from 'fp-ts/Task';
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
import {randomUUID} from 'crypto';
import {getResourceEvents} from '../../src/init-dependencies/event-store/get-resource-events';
import {EventName, EventOfType} from '../../src/types/domain-event';
import {Dependencies} from '../../src/dependencies';
import {applyToResource} from '../../src/commands/apply-command-to-resource';
import {initSharedReadModel} from '../../src/read-models/shared-state';
import {localPullGoogleSheetData} from '../init-dependencies/pull-local-google';

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
};

export const initTestFramework = async (
  googleRateLimitMs: number = 120_000
): Promise<TestFramework> => {
  const logger = createLogger({level: 'silent'});
  const dbClient = libsqlClient.createClient({
    url: `file:/tmp/${randomUUID()}.db`,
  });
  const sharedReadModel = initSharedReadModel(
    dbClient,
    logger,
    localPullGoogleSheetData,
    googleRateLimitMs
  );
  const frameworkCommitEvent = commitEvent(
    dbClient,
    logger,
    sharedReadModel.asyncRefresh
  );
  await ensureEventTableExists(dbClient)();
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
    commands: {
      area: {
        create: frameworkify(commands.area.create),
        remove: frameworkify(commands.area.remove),
        addOwner: frameworkify(commands.area.addOwner),
      },
      equipment: {
        add: frameworkify(commands.equipment.add),
        trainingSheet: frameworkify(commands.equipment.trainingSheet),
      },
      trainers: {
        add: frameworkify(commands.trainers.add),
        markTrained: frameworkify(commands.trainers.markTrained),
      },
      members: {
        editName: frameworkify(commands.members.editName),
        editPronouns: frameworkify(commands.members.editPronouns),
        signOwnerAgreement: frameworkify(commands.members.signOwnerAgreement),
        editEmail: frameworkify(commands.members.editEmail),
      },
      memberNumbers: {
        linkNumberToEmail: frameworkify(
          commands.memberNumbers.linkNumberToEmail
        ),
      },
      superUser: {
        declare: frameworkify(commands.superUser.declare),
        revoke: frameworkify(commands.superUser.revoke),
      },
    },
  };
};
