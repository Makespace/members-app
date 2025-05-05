import * as O from 'fp-ts/Option';
import {
  LinkNumberToEmail,
  linkNumberToEmail,
} from '../../../src/commands/member-numbers/link-number-to-email';
import {faker} from '@faker-js/faker';
import {
  DomainEvent,
  EmailAddress,
  constructEvent,
  isEventOfType,
} from '../../../src/types';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryActor, getSomeOrFail} from '../../helpers';
import {applyToResource} from '../../../src/commands/apply-command-to-resource';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('linkNumberToEmail', () => {
  let framework: TestFramework;
  let applyLinkNumberToEmail: ReturnType<
    typeof applyToResource<LinkNumberToEmail>
  >;
  beforeEach(async () => {
    framework = await initTestFramework();
    applyLinkNumberToEmail = applyToResource(
      framework.depsForApplyToResource,
      linkNumberToEmail
    );
  });
  afterEach(() => {
    framework.eventStoreDb.close();
  });

  const command = {
    email: faker.internet.email() as EmailAddress,
    memberNumber: faker.number.int(),
    actor: arbitraryActor(),
  };

  describe('when give the same command multiple times', () => {
    beforeEach(async () => {
      await applyLinkNumberToEmail(command, arbitraryActor())();
      await applyLinkNumberToEmail(command, arbitraryActor())();
    });

    it('only raises one event', async () => {
      const events = await framework.getAllEvents();
      expect(events).toHaveLength(1);
      expect(isEventOfType('MemberNumberLinkedToEmail')(events[0])).toBe(true);
    });
  });

  describe('when the member number already exists', () => {
    const events: ReadonlyArray<DomainEvent> = [
      constructEvent('MemberNumberLinkedToEmail')({
        memberNumber: command.memberNumber,
        email: faker.internet.email() as EmailAddress,
      }),
    ];
    const result = linkNumberToEmail.process({command, events});
    it('returns none', () => {
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the email address is already in use', () => {
    const events: ReadonlyArray<DomainEvent> = [
      constructEvent('MemberNumberLinkedToEmail')({
        memberNumber: faker.number.int(),
        email: command.email,
      }),
    ];
    const result = pipe(
      {command, events},
      linkNumberToEmail.process,
      O.filter(
        isEventOfType('LinkingMemberNumberToAnAlreadyUsedEmailAttempted')
      ),
      getSomeOrFail
    );
    it('raises an event documenting the attempt', () => {
      expect(result.email).toStrictEqual(command.email);
    });
  });

  describe('when both the email and member number are new', () => {
    const events: ReadonlyArray<DomainEvent> = [];
    const event = pipe(
      {command, events},
      linkNumberToEmail.process,
      O.filter(isEventOfType('MemberNumberLinkedToEmail')),
      getSomeOrFail
    );

    it('raises an event linking the number and email', () => {
      expect(event.email).toStrictEqual(command.email);
      expect(event.memberNumber).toStrictEqual(command.memberNumber);
    });
  });
});
