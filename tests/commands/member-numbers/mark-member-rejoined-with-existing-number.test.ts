import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {constructEvent, EmailAddress} from '../../../src/types';
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

  it('does nothing when the member is not currently a super user', async () => {
    await linkMember();

    const result = await getTaskEitherRightOrFail(
      markMemberRejoinedWithExistingNumber.process({
        command,
        events: [],
        rm: framework.sharedReadModel,
      })
    );

    expect(result).toStrictEqual(O.none);
  });

  it('raises an event when the member is currently a super user', async () => {
    await linkMember();
    framework.insertIntoSharedReadModel(
      constructEvent('SuperUserDeclared')({
        memberNumber,
        actor: arbitraryActor(),
      })
    );

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

  it('does nothing once the member has already been marked as rejoined', async () => {
    await linkMember();
    framework.insertIntoSharedReadModel(
      constructEvent('SuperUserDeclared')({
        memberNumber,
        actor: arbitraryActor(),
      })
    );
    framework.insertIntoSharedReadModel(
      constructEvent('MemberRejoinedWithExistingNumber')({
        memberNumber,
        actor: arbitraryActor(),
      })
    );

    const result = await getTaskEitherRightOrFail(
      markMemberRejoinedWithExistingNumber.process({
        command,
        events: [],
        rm: framework.sharedReadModel,
      })
    );

    expect(result).toStrictEqual(O.none);
  });
});
