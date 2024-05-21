import * as T from 'fp-ts/Task';
import {getAllEvents} from '../../src/init-dependencies/event-store/get-all-events';
import {initQueryEventsDatabase} from '../../src/init-dependencies/event-store/init-query-events-database';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-event-table-exists';
import {DomainEvent} from '../../src/types';
import {pipe} from 'fp-ts/lib/function';
import {commands} from '../../src/commands';
import {commitEvent} from '../../src/init-dependencies/event-store/commit-event';
import {Command} from '../../src/commands/command';
import {persistOrNoOp} from '../../src/commands/persist-or-no-op';
import {getRightOrFail} from '../helpers';

type ToFrameworkCommands<T> = {
  [K in keyof T]: {
    [M in keyof T[K]]: T[K][M] extends {
      process: (input: {
        command: infer C;
        events: ReadonlyArray<DomainEvent>;
      }) => unknown;
    }
      ? (c: C) => Promise<void>
      : never;
  };
};
export type TestFramework = {
  getAllEvents: () => Promise<ReadonlyArray<DomainEvent>>;
  commands: ToFrameworkCommands<typeof commands>;
};
export const initTestFramework = async (): Promise<TestFramework> => {
  const queryEventsDatabase = initQueryEventsDatabase();
  const frameworkCommitEvent = commitEvent(queryEventsDatabase);
  await ensureEventTableExists(queryEventsDatabase)();
  const frameworkGetAllEvents = () =>
    pipe(getAllEvents(queryEventsDatabase)(), T.map(getRightOrFail))();

  const frameworkify =
    <T>(command: Command<T>) =>
    async (commandPayload: T) => {
      const events = await frameworkGetAllEvents();
      await pipe(
        command.process({command: commandPayload, events}),
        persistOrNoOp(frameworkCommitEvent)
      )();
    };

  return {
    getAllEvents: frameworkGetAllEvents,
    commands: {
      area: {
        create: frameworkify(commands.area.create),
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
