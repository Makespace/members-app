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
import {
  ensureSheetDataSyncMetadataTableExists,
  ensureSheetDataTableExists,
  ensureTroubleTicketDataTableExists,
} from '../../src/sync-worker/google/ensure-sheet-data-tables-exist';
import {getTroubleTicketData} from '../../src/sync-worker/db/get_trouble_ticket_data';
import {storeTrainingSheetRowsRead} from '../../src/sync-worker/db/store_training_sheet_rows_read';
import {storeTroubleTicketRowsRead} from '../../src/sync-worker/db/store_trouble_ticket_rows_read';
import {SyncWorkerDependencies} from '../../src/sync-worker/dependencies';

export const TROUBLE_TICKET_SHEET_ID = 'trouble_ticket_sheet_id';

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
  getTroubleTicketData: Dependencies['getTroubleTicketData'];
  storeTrainingSheetRowsRead: SyncWorkerDependencies['storeTrainingSheetRowsRead'];
  storeTroubleTicketRowsRead: SyncWorkerDependencies['storeTroubleTicketRowsRead'];
};

export const initTestFramework = async (): Promise<TestFramework> => {
  const logger = createLogger({level: 'silent'});
  const dbClient = libsqlClient.createClient({
    url: ':memory:',
  });
  const sharedReadModel = initSharedReadModel(dbClient, logger, O.none);
  const frameworkCommitEvent = commitEvent(
    dbClient,
    logger,
    sharedReadModel.asyncRefresh
  );
  getRightOrFail(await ensureEventTableExists(dbClient)());
  await ensureSheetDataTableExists(dbClient);
  await ensureSheetDataSyncMetadataTableExists(dbClient);
  await ensureTroubleTicketDataTableExists(dbClient);
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
    getTroubleTicketData: getTroubleTicketData(
      dbClient,
      O.some(TROUBLE_TICKET_SHEET_ID)
    ),
    storeTrainingSheetRowsRead: storeTrainingSheetRowsRead(dbClient),
    storeTroubleTicketRowsRead: storeTroubleTicketRowsRead(dbClient),
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
        removeOwner: frameworkify(commands.area.removeOwner),
      },
      equipment: {
        add: frameworkify(commands.equipment.add),
        trainingSheet: frameworkify(commands.equipment.trainingSheet),
        removeTrainingSheet: frameworkify(
          commands.equipment.removeTrainingSheet
        ),
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
        markMemberRejoinedWithNewNumber: frameworkify(
          commands.memberNumbers.markMemberRejoinedWithNewNumber
        ),
        markMemberRejoinedWithExistingNumber: frameworkify(
          commands.memberNumbers.markMemberRejoinedWithExistingNumber
        ),
      },
      superUser: {
        declare: frameworkify(commands.superUser.declare),
        revoke: frameworkify(commands.superUser.revoke),
      },
    },
  };
};
