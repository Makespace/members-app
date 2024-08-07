import {faker} from '@faker-js/faker';
import {updateState} from '../../../src/read-models/shared-state';
import {asyncRefresh} from '../../../src/read-models/shared-state/async-refresh';
import {initTestFramework, TestFramework} from '../test-framework';
import {EmailAddress} from '../../../src/types';
import {sql} from 'drizzle-orm';

const arbitraryLinkNumberCommand = () => ({
  memberNumber: faker.number.int(),
  email: faker.internet.email() as EmailAddress,
});

describe('async-refresh', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  it('creates the necessary tables', async () => {
    await asyncRefresh(
      framework.eventStoreDb,
      framework.sharedReadModel.db,
      updateState(framework.sharedReadModel.db)
    )()();
    const tables = framework.sharedReadModel.db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`
    );
    expect(tables.length).toBeGreaterThan(0);
  });

  describe('when the read model is empty', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        arbitraryLinkNumberCommand()
      );
      await framework.commands.memberNumbers.linkNumberToEmail(
        arbitraryLinkNumberCommand()
      );
    });

    it('processes all events', async () => {
      const updateStateSpy = jest.fn(updateState(framework.sharedReadModel.db));
      await asyncRefresh(
        framework.eventStoreDb,
        framework.sharedReadModel.db,
        updateStateSpy
      )()();
      expect(updateStateSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the read model has already been refreshed', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        arbitraryLinkNumberCommand()
      );
    });

    it('does nothing', async () => {
      const updateStateSpy = jest.fn(updateState(framework.sharedReadModel.db));
      await asyncRefresh(
        framework.eventStoreDb,
        framework.sharedReadModel.db,
        updateState(framework.sharedReadModel.db)
      )()();
      await asyncRefresh(
        framework.eventStoreDb,
        framework.sharedReadModel.db,
        updateStateSpy
      )()()/*  */;
      expect(updateStateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("when new events exist that haven't been processed by the read model", () => {
    it.todo('only processes the new events');
  });
});
