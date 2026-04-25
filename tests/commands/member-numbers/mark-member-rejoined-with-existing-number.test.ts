import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {EmailAddress} from '../../../src/types';
import {
  markMemberRejoinedWithExistingNumber,
} from '../../../src/commands/member-numbers/mark-member-rejoined-with-existing-number';
import {arbitraryActor, getTaskEitherRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('markMemberRejoinedWithExistingNumber', () => {
  let framework: TestFramework;
  const memberNumber = faker.number.int() as Int;
  const command = {
    memberNumber,
    actor: arbitraryActor(),
  };

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  const linkMember = () =>
    framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });

  it('raises an event', async () => {
    await linkMember();
    const result = await getTaskEitherRightOrFail(
      markMemberRejoinedWithExistingNumber.process({
        command,
        events: [],
        rm: framework.sharedReadModel,
      })
    );

    expect(result).toStrictEqual(
      O.some(
        expect.objectContaining({
          type: 'MemberRejoinedWithExistingNumber',
          memberNumber,
        })
      )
    );
  });
});
