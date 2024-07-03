import {EmailAddress} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {getFailedImports} from '../../../src/read-models/members/get-failed-imports';
import {faker} from '@faker-js/faker';

describe('getFailedImports', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when the email is already in use', () => {
    const previousLinking = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
    };
    const attempt = {
      memberNumber: faker.number.int(),
      email: previousLinking.email,
    };

    it.failing('returns the attempted linking', async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(previousLinking);
      await framework.commands.memberNumbers.linkNumberToEmail(attempt);
      const events = await framework.getAllEvents();
      const result = getFailedImports(events);

      expect(result).toHaveLength(1);
      expect(result[0].memberNumber).toStrictEqual(attempt.memberNumber);
      expect(result[0].email).toStrictEqual(attempt.email);
    });
  });
});
