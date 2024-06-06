import createLogger from 'pino';
import * as T from 'fp-ts/Task';
import {getAllEvents} from '../../src/init-dependencies/event-store/get-all-events';
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
  commands: ToFrameworkCommands<typeof commands>;
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
    commands: {
      area: {
        create: frameworkify(commands.area.create),
        addOwner: frameworkify(commands.area.addOwner),
      },
      equipment: {
        add: frameworkify(commands.equipment.add),
        training_sheet: frameworkify(commands.equipment.training_sheet),
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
