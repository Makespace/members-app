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
  MarkMemberRejoined,
  markMemberRejoined,
} from '../../../src/commands/member-numbers/mark-member-rejoined';
import {Int} from 'io-ts';

describe('markMemberRejoined', () => {
  let framework: TestFramework;
  let applyMarkMemberRejoined: ReturnType<
    typeof applyToResource<MarkMemberRejoined>
  >;
  beforeEach(async () => {
    framework = await initTestFramework();
    applyMarkMemberRejoined = applyToResource(
      framework.depsForApplyToResource,
      markMemberRejoined
    );
  });
  const command = {
    oldMembershipNumber: faker.number.int() as Int,
    newMembershipNumber: faker.number.int() as Int,
    actor: arbitraryActor(),
  };

  describe('when give the same command multiple times', () => {
    beforeEach(async () => {
      await applyMarkMemberRejoined(command, arbitraryActor())();
      await applyMarkMemberRejoined(command, arbitraryActor())();
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
      markMemberRejoined.process,
      O.filter(isEventOfType('MemberRejoinedWithNewNumber')),
      getSomeOrFail
    );

    it('raises an event linking the memberships', () => {
      expect(event.oldMembershipNumber).toStrictEqual(
        command.oldMembershipNumber
      );
      expect(event.newMembershipNumber).toStrictEqual(
        command.newMembershipNumber
      );
      expect(event.actor).toStrictEqual(command.actor);
    });
  });
});
