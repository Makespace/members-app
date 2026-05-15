import createLogger from 'pino';
import * as T from 'fp-ts/Task';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {
  getAllEvents,
  getAllEventsByType,
  getDeletedEventByIndex,
  getDeletedEvents,
  getEventByIndex,
} from '../../src/init-dependencies/event-store/get-all-events';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-events-table-exists';
import {Actor, DomainEvent} from '../../src/types';
import {pipe} from 'fp-ts/lib/function';
import {commands, Command} from '../../src/commands';
import {commitEvent} from '../../src/init-dependencies/event-store/commit-event';
import {arbitraryActor, getRightOrFail, getTaskEitherRightOrFail} from '../helpers';
import * as libsqlClient from '@libsql/client';
import {EventName, EventOfType, StoredDomainEvent} from '../../src/types/domain-event';
import {Dependencies} from '../../src/dependencies';
import {applyCommand} from '../../src/commands/apply-command';
import {initSharedReadModel} from '../../src/read-models/shared-state';
import {getTroubleTicketData} from '../../src/sync-worker/db/get_trouble_ticket_data';
import {SyncWorkerDependencies} from '../../src/sync-worker/dependencies';
import {lastSync} from '../../src/sync-worker/db/last_sync';
import {getSheetData, getSheetDataByMemberNumber} from '../../src/sync-worker/db/get_sheet_data';
import {TrainingSummaryDeps} from '../../src/sync-worker/training-summary/training-summary-deps';
import {NonEmptyString} from 'io-ts-types/lib/NonEmptyString';
import { faker } from '@faker-js/faker';
import { UUID } from 'io-ts-types';
import { updateTrainingSheetCache } from '../../src/sync-worker/db/update_training_sheet_cache';
import { updateTroubleTicketCache } from '../../src/sync-worker/db/update_trouble_ticket_cache';
import { ensureExtDBTablesExist, ExternalStateDB, initExternalStateDB } from '../../src/sync-worker/external-state-db';
import {Int} from 'io-ts';
import { deleteEvent, unDeleteEvent } from '../../src/init-dependencies/event-store/set-event-deleted-state';

const TROUBLE_TICKET_SHEET_ID = 'trouble_ticket_sheet_id';

type ToFrameworkCommands<T> = {
  [K in keyof T]: {
    [M in keyof T[K]]: T[K][M] extends {
      process: (input: {
        command: infer C;
        events: ReadonlyArray<DomainEvent>;
        rm: Dependencies['sharedReadModel'];
      }) => unknown;
    }
      ? (c: Omit<C, 'actor'> & { actor?: Actor }) => Promise<void>
      : never;
  };
};

export type TestFramework = {
  getAllEvents: () => Promise<ReadonlyArray<StoredDomainEvent>>;
  getAllEventsByType: <T extends EventName>(
    eventType: T
  ) => Promise<ReadonlyArray<EventOfType<T>>>;
  commands: ToFrameworkCommands<typeof commands>;
  sharedReadModel: Dependencies['sharedReadModel'];
  depsForCommands: Dependencies;
  eventStoreDb: libsqlClient.Client;
  extDB: ExternalStateDB;
  getTroubleTicketData: Dependencies['getTroubleTicketData'];
  updateTrainingSheetCache: SyncWorkerDependencies['updateTrainingSheetCache'];
  updateTroubleTicketCache: SyncWorkerDependencies['updateTroubleTicketCache'];
  close: () => void;
  lastSync: SyncWorkerDependencies['lastSync'];
  getSheetData: Dependencies['getSheetData'];
  getSheetDataByMemberNumber: Dependencies['getSheetDataByMemberNumber'];
  trainingSummaryDeps: TrainingSummaryDeps;
  insertIntoSharedReadModel: (event: DomainEvent) => StoredDomainEvent;
};

const insertIntoSharedReadModel = (rm: Dependencies['sharedReadModel']) => (event: DomainEvent): StoredDomainEvent => {
  // Test helper to update the shared read model with an event with the event index and id automatically generated.
  // This essentially does a DomainEvent -> StoredDomainEvent conversion and then inserts the result.
  const storedEvent: StoredDomainEvent = {
    ...event,
    event_id: faker.string.uuid() as UUID,
    event_index: (rm.getCurrentEventIndex() + 1) as Int,
    deletedAt: null,
    deleteReason: null,
    markDeletedByMemberNumber: null,
  };
  rm.updateState(storedEvent);
  return storedEvent;
}

export const initTestFramework = async (): Promise<TestFramework> => {
  const logger = createLogger({level: 'silent'});
  const eventDB = libsqlClient.createClient({
    url: ':memory:',
  });
  const extDBClient = libsqlClient.createClient({
    url: ':memory:',
  });
  const extDBDrizzle = initExternalStateDB(extDBClient);
  const sharedReadModel = initSharedReadModel(eventDB, logger);
  const frameworkCommitEvent = commitEvent(
    eventDB,
    logger,
    sharedReadModel.asyncRefresh
  );
  getRightOrFail(await ensureEventTableExists(eventDB)());
  await ensureExtDBTablesExist(extDBDrizzle)();
  const frameworkGetAllEvents = () =>
    pipe(getAllEvents(eventDB)(), T.map(getRightOrFail))();
  const frameworkGetAllEventsByType = <EN extends EventName>(eventType: EN) =>
    pipe(getAllEventsByType(eventDB)(eventType), T.map(getRightOrFail))();
  const depsForCommands: Dependencies = {
    commitEvent: frameworkCommitEvent,
    getAllEvents: getAllEvents(eventDB),
    getDeletedEvents: getDeletedEvents(eventDB),
    getAllEventsByType: getAllEventsByType(eventDB),
    deleteEvent: deleteEvent(eventDB, sharedReadModel.reset),
    unDeleteEvent: unDeleteEvent(eventDB, sharedReadModel.reset),
    sharedReadModel,
    logger,
    extDB: extDBDrizzle,
    rateLimitSendingOfEmails: TE.right,
    sendEmail: () => TE.right('success'),
    lastQuizSync: lastSync(extDBDrizzle),
    getSheetData: getSheetData(extDBDrizzle),
    getSheetDataByMemberNumber: getSheetDataByMemberNumber(extDBDrizzle),
    getTroubleTicketData: getTroubleTicketData(
      extDBDrizzle,
      O.some(TROUBLE_TICKET_SHEET_ID)
    ),
    getEventByIndex: getEventByIndex(eventDB),
    getDeletedEventByIndex: getDeletedEventByIndex(eventDB),
  };

  const frameworkify =
    <T>(command: Command<T>) =>
    async (commandPayload: T & {actor?: Actor}) => {
      await getTaskEitherRightOrFail(
        applyCommand(depsForCommands, command)(
          commandPayload,
          commandPayload.actor ?? arbitraryActor()
        )
      );
    };

  return {
    getAllEvents: frameworkGetAllEvents,
    getAllEventsByType: frameworkGetAllEventsByType,
    getTroubleTicketData: getTroubleTicketData(
      extDBDrizzle,
      O.some(TROUBLE_TICKET_SHEET_ID)
    ),
    updateTrainingSheetCache: updateTrainingSheetCache(extDBDrizzle),
    updateTroubleTicketCache: updateTroubleTicketCache(extDBDrizzle),
    eventStoreDb: eventDB,
    extDB: extDBDrizzle,
    sharedReadModel,
    depsForCommands,
    close: () => {
      eventDB.close();
      extDBClient.close();
    },
    lastSync: lastSync(extDBDrizzle),
    getSheetData: getSheetData(extDBDrizzle),
    getSheetDataByMemberNumber: getSheetDataByMemberNumber(extDBDrizzle),
    commands: {
      area: {
        create: frameworkify(commands.area.create),
        remove: frameworkify(commands.area.remove),
        addOwner: frameworkify(commands.area.addOwner),
        removeOwner: frameworkify(commands.area.removeOwner),
        setMailingList: frameworkify(commands.area.setMailingList),
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
        markMemberTrainedBy: frameworkify(
          commands.trainers.markMemberTrainedBy
        ),
      },
      members: {
        editName: frameworkify(commands.members.editName),
        editFormOfAddress: frameworkify(commands.members.editFormOfAddress),
        signOwnerAgreement: frameworkify(commands.members.signOwnerAgreement),
        addEmail: frameworkify(commands.members.addEmail),
        changePrimaryEmail: frameworkify(commands.members.changePrimaryEmail),
        sendEmailVerification: frameworkify(
          commands.members.sendEmailVerification
        ),
        verifyEmail: frameworkify(commands.members.verifyEmail),
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
      eventLog: {
        delete: frameworkify(commands.eventLog.delete),
        undelete: frameworkify(commands.eventLog.undelete),
      },
    },
    trainingSummaryDeps: {
      logger,
      commitEvent: frameworkCommitEvent,
      sharedReadModel,
      getSheetData: getSheetData(extDBDrizzle),
      sendEmail: jest.fn(() => TE.right('success')),
      lastQuizSync: lastSync(extDBDrizzle),
      conf: {
        PUBLIC_URL: 'https://localhost' as NonEmptyString,
      },
      extDB: extDBDrizzle,
    },
    insertIntoSharedReadModel: insertIntoSharedReadModel(sharedReadModel),
  };
};
