import {faker} from '@faker-js/faker';
import {EmailAddress} from '../../../src/types';
import {initTestFramework, TestFramework} from '../test-framework';

const createMember = async (framework: TestFramework, memberNumber: number) =>
  framework.commands.memberNumbers.linkNumberToEmail({
    memberNumber,
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
  });

describe('find all super users', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('returns current super users', async () => {
    const regularMemberNumber = faker.number.int();
    const revokedSuperUserNumber = faker.number.int();
    const superUserNumber = faker.number.int();

    await createMember(framework, regularMemberNumber);
    await createMember(framework, revokedSuperUserNumber);
    await createMember(framework, superUserNumber);
    await framework.commands.superUser.declare({
      memberNumber: revokedSuperUserNumber,
    });
    await framework.commands.superUser.revoke({
      memberNumber: revokedSuperUserNumber,
    });
    await framework.commands.superUser.declare({memberNumber: superUserNumber});

    expect(
      framework.sharedReadModel.members
        .findAllSuperUsers()
        .map(member => member.memberNumber)
    ).toStrictEqual([superUserNumber]);
  });
});
