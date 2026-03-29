import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {DomainEvent, isEventOfType} from '../../../src/types';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryActor, getSomeOrFail} from '../../helpers';
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

  const command = {
    oldMemberNumber: faker.number.int() as Int,
    newMemberNumber: faker.number.int() as Int,
    actor: arbitraryActor(),
  };

  describe('when give the same command multiple times', () => {
    beforeEach(async () => {
      await applyMarkMemberRejoinedWithNewNumber(command, arbitraryActor())();
      await applyMarkMemberRejoinedWithNewNumber(command, arbitraryActor())();
    });

    it('only raises one event', async () => {
      const events = await framework.getAllEvents();
      expect(events).toHaveLength(1);
      expect(isEventOfType('MemberRejoinedWithNewNumber')(events[0])).toBe(
        true
      );
    });
  });

  describe('link 2 memberships together', () => {
    const events: ReadonlyArray<DomainEvent> = [];
    const event = pipe(
      {command, events},
      markMemberRejoinedWithNewNumber.process,
      O.filter(isEventOfType('MemberRejoinedWithNewNumber')),
      getSomeOrFail
    );

    it('raises an event linking the memberships', () => {
      expect(event.oldMemberNumber).toStrictEqual(command.oldMemberNumber);
      expect(event.newMemberNumber).toStrictEqual(command.newMemberNumber);
      expect(event.actor).toStrictEqual(command.actor);
    });
  });
});
