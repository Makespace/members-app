import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {lookupByEmail} from '../../../../src/queries/members/lookup-by-email';
import {faker} from '@faker-js/faker';
import {getAllEvents} from '../../../../src/init-dependencies/event-store/get-all-events';
import {initQueryEventsDatabase} from '../../../../src/init-dependencies/event-store/init-events-database';
import {ensureEventTableExists} from '../../../../src/init-dependencies/event-store/ensure-event-table-exists';
import {DomainEvent, EmailAddress} from '../../../../src/types';
import {shouldNotBeCalled} from '../../../should-not-be-called.helper';
import {pipe} from 'fp-ts/lib/function';
import {commands} from '../../../../src/commands';
import {persistOrNoOp} from '../../../../src/commands/api-post';
import {commitEvent} from '../../../../src/init-dependencies/event-store/commit-event';
import {Command} from '../../../../src/types/command';

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

type TestFramework = {
  getAllEvents: () => Promise<ReadonlyArray<DomainEvent>>;
  commands: ToFrameworkCommands<typeof commands>;
};

const initTestFramework = async (): Promise<TestFramework> => {
  const queryEventsDatabase = initQueryEventsDatabase();
  const frameworkCommitEvent = commitEvent(queryEventsDatabase);
  await ensureEventTableExists(queryEventsDatabase)();
  const frameworkGetAllEvents = () =>
    pipe(
      getAllEvents(queryEventsDatabase)(),
      TE.getOrElse(shouldNotBeCalled)
    )();

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

describe('lookupByEmail', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when no members exist', () => {
    beforeEach(async () => {
      events = await framework.getAllEvents();
    });

    it('returns none', () => {
      const result = lookupByEmail(faker.internet.email())(events);
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when a member with the given email exists', () => {
    const command = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(command);
      events = await framework.getAllEvents();
    });

    it('returns their member number', () => {
      const result = lookupByEmail(command.email)(events);
      expect(result).toStrictEqual(O.some(command.memberNumber));
    });
  });

  describe('when no member with the given email exists', () => {
    const command = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(command);
      events = await framework.getAllEvents();
    });

    it('returns none', () => {
      const result = lookupByEmail(faker.internet.email())(events);
      expect(result).toStrictEqual(O.none);
    });
  });
});
