import createLogger from 'pino';
import * as T from 'fp-ts/Task';
import {
  getAllEvents,
  getAllEventsByType,
} from '../../src/init-dependencies/event-store/get-all-events';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-event-table-exists';
import {DomainEvent} from '../../src/types';
import {pipe} from 'fp-ts/lib/function';
import {commands, Command} from '../../src/commands';
import {commitEvent} from '../../src/init-dependencies/event-store/commit-event';
import {persistOrNoOp} from '../../src/commands/persist-or-no-op';
import {arbitraryActor, getRightOrFail} from '../helpers';
import * as libsqlClient from '@libsql/client';
import {randomUUID} from 'crypto';
import {Resource} from '../../src/types/resource';
import {getResourceEvents} from '../../src/init-dependencies/event-store/get-resource-events';
import {EventName, EventOfType} from '../../src/types/domain-event';
import {Dependencies} from '../../src/dependencies';

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
  depsForApplyToResource: {
    commitEvent: Dependencies['commitEvent'];
    getResourceEvents: Dependencies['getResourceEvents'];
  };
};

export const initTestFramework = async (): Promise<TestFramework> => {
  const dbClient = libsqlClient.createClient({
    url: `file:/tmp/${randomUUID()}.db`,
  });
  const frameworkCommitEvent = commitEvent(
    dbClient,
    createLogger({level: 'silent'})
  );
  await ensureEventTableExists(dbClient)();
  const frameworkGetAllEvents = () =>
    pipe(getAllEvents(dbClient)(), T.map(getRightOrFail))();
  const frameworkGetAllEventsByType = <EN extends EventName>(eventType: EN) =>
    pipe(getAllEventsByType(dbClient)(eventType), T.map(getRightOrFail))();
  const frameworkGetResourceEvents = (resource: Resource) =>
    pipe(getResourceEvents(dbClient)(resource), T.map(getRightOrFail))();

  const frameworkify =
    <T>(command: Command<T>) =>
    async (commandPayload: T) => {
      const resource = command.resource(commandPayload);
      const {events, version} = await frameworkGetResourceEvents(resource);
      await pipe(
        command.process({
          command: {
            ...commandPayload,
            actor: arbitraryActor(),
          },
          events,
        }),
        persistOrNoOp(frameworkCommitEvent, resource, version)
      )();
    };

  return {
    getAllEvents: frameworkGetAllEvents,
    getAllEventsByType: frameworkGetAllEventsByType,
    depsForApplyToResource: {
      commitEvent: frameworkCommitEvent,
      getResourceEvents: getResourceEvents(dbClient),
    },
    commands: {
      area: {
        create: frameworkify(commands.area.create),
        addOwner: frameworkify(commands.area.addOwner),
      },
      equipment: {
        add: frameworkify(commands.equipment.add),
        trainingSheet: frameworkify(commands.equipment.trainingSheet),
        trainingSheetQuizResult: frameworkify(
          commands.equipment.trainingSheetQuizResult
        ),
      },
      trainers: {
        add: frameworkify(commands.trainers.add),
      },
      members: {
        editName: frameworkify(commands.members.editName),
        editPronouns: frameworkify(commands.members.editPronouns),
        signOwnerAgreement: frameworkify(commands.members.signOwnerAgreement),
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
