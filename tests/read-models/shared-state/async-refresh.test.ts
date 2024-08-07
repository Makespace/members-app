import {faker} from '@faker-js/faker';
import {updateState} from '../../../src/read-models/shared-state';
import {asyncRefresh} from '../../../src/read-models/shared-state/async-refresh';
import {initTestFramework, TestFramework} from '../test-framework';
import {EmailAddress} from '../../../src/types';

const arbitraryLinkNumberCommand = () => ({
  memberNumber: faker.number.int(),
  email: faker.internet.email() as EmailAddress,
});

describe('async-refresh', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when the read model is empty', () => {
    it.todo('creates the necessary tables');
    it.todo('processes all events');
  });

  describe('when the read model is up to date', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        arbitraryLinkNumberCommand()
      );
      await asyncRefresh(
        framework.eventStoreDb,
        framework.sharedReadModel.db
      )()();
    });

    it('does nothing', async () => {
      const updateStateSpy = jest.fn(updateState(framework.sharedReadModel.db));
      await asyncRefresh(
        framework.eventStoreDb,
        framework.sharedReadModel.db
      )()();
      expect(updateStateSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe("when new events exist that haven't been processed by the read model", () => {
    it.todo('only processes the new events');
  });
});
