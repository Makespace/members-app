import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import {getPotentialOwners} from '../../../src/read-models/members/getPotentialOwners';
import {TestFramework, initTestFramework} from '../test-framework';
import {EmailAddress} from '../../../src/types';

describe('getPotentialOwners', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  let result: ReturnType<typeof getPotentialOwners>;
  describe('when a member is already an owner of the area', () => {
    const linkNumber = {
      email: faker.internet.email() as EmailAddress,
      memberNumber: faker.number.int(),
    };
    const addName = {
      name: faker.person.fullName(),
      memberNumber: linkNumber.memberNumber,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(linkNumber);
      await framework.commands.members.editName(addName);
    });

    it.failing('includes them in the existing owners', () => {
      expect(result.existing[0].number).toStrictEqual(linkNumber.memberNumber);
      expect(result.existing[0].name).toStrictEqual(O.some(addName.name));
    });
  });

  describe('when a member is an owner of another area', () => {
    it.todo('includes the area name');
  });

  describe('when a member has signed the owner agreement', () => {
    it.todo('includes the date they signed');
  });
});
