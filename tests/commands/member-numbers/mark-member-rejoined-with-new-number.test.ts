import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {EmailAddress, constructEvent, isEventOfType} from '../../../src/types';
import {pipe} from 'fp-ts/lib/function';
import {
  arbitraryActor,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {applyToResource} from '../../../src/commands/apply-command-to-resource';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';
import {
  MarkMemberRejoinedWithNewNumber,
  markMemberRejoinedWithNewNumber,
} from '../../../src/commands/member-numbers/mark-member-rejoined-with-new-number';
import {Int} from 'io-ts';

describe('markMemberRejoinedWithNewNumber', () => {
  let framework: TestFramework;
  let applyMarkMemberRejoinedWithNewNumber: ReturnType<
    typeof applyToResource<MarkMemberRejoinedWithNewNumber>
  >;
  beforeEach(async () => {
    framework = await initTestFramework();
    applyMarkMemberRejoinedWithNewNumber = applyToResource(
      framework.depsForApplyToResource,
      markMemberRejoinedWithNewNumber
    );
  });
  afterEach(() => {
    framework.close();
  });

  const oldMemberNumber = faker.number.int() as Int;
  const command = {
    oldMemberNumber,
    newMemberNumber: faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int,
    actor: arbitraryActor(),
  };

  describe('when give the same command multiple times', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: command.oldMemberNumber,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: command.newMemberNumber,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
      await applyMarkMemberRejoinedWithNewNumber(command, arbitraryActor())();
      await applyMarkMemberRejoinedWithNewNumber(command, arbitraryActor())();
    });

    it('only raises one event', async () => {
      const events = await framework.getAllEventsByType(
        'MemberRejoinedWithNewNumber'
      );
      expect(events).toHaveLength(1);
    });
  });

  describe('link 2 memberships together', () => {
    it('raises an event linking the memberships', async () => {
      const event = pipe(
        await getTaskEitherRightOrFail(
          markMemberRejoinedWithNewNumber.process({
            command,
            rm: framework.sharedReadModel,
          })
        ),
        O.filter(isEventOfType('MemberRejoinedWithNewNumber')),
        getSomeOrFail
      );

      expect(event.oldMemberNumber).toStrictEqual(command.oldMemberNumber);
      expect(event.newMemberNumber).toStrictEqual(command.newMemberNumber);
      expect(event.actor).toStrictEqual(command.actor);
    });
  });

  it('does nothing once the member numbers already resolve to the same user', async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: command.oldMemberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: command.newMemberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    framework.insertIntoSharedReadModel(
      constructEvent('MemberRejoinedWithNewNumber')({
        oldMemberNumber: command.oldMemberNumber,
        newMemberNumber: command.newMemberNumber,
        actor: arbitraryActor(),
      })
    );

    const result = await getTaskEitherRightOrFail(
      markMemberRejoinedWithNewNumber.process({
        command,
        rm: framework.sharedReadModel,
      })
    );

    expect(result).toStrictEqual(O.none);
  });
});
