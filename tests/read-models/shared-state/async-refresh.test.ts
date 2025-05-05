import {faker} from '@faker-js/faker';
import {asyncRefresh} from '../../../src/read-models/shared-state/async-refresh';
import {initTestFramework, TestFramework} from '../test-framework';
import {EmailAddress} from '../../../src/types';
import {sql} from 'drizzle-orm';
import {updateState} from '../../../src/read-models/shared-state/update-state';

const arbitraryLinkNumberCommand = () => ({
  memberNumber: faker.number.int(),
  email: faker.internet.email() as EmailAddress,
});

describe('async-refresh', () => {
  let framework: TestFramework;
  let refresh: ReturnType<typeof asyncRefresh>;
  let updateStateSpy: jest.Mock;

  beforeEach(async () => {
    framework = await initTestFramework();
    updateStateSpy = jest.fn(
      updateState(
        framework.sharedReadModel.db,
        framework.sharedReadModel.linking
      )
    );
    refresh = asyncRefresh(framework.eventStoreDb, updateStateSpy);
  });

  it('creates the necessary tables', async () => {
    await refresh()();
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
      await refresh()();
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
      await refresh()();
      await refresh()();
      expect(updateStateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("when new events exist that haven't been processed by the read model", () => {
    it('only processes the new events', async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        arbitraryLinkNumberCommand()
      );
      await refresh()();
      await framework.commands.memberNumbers.linkNumberToEmail(
        arbitraryLinkNumberCommand()
      );
      await refresh()();
      expect(updateStateSpy).toHaveBeenCalledTimes(2);
    });
  });
});
