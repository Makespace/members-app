import * as O from 'fp-ts/Option';
import {lookupByEmail} from '../../../src/read-models/members/lookup-by-email';
import {faker} from '@faker-js/faker';
import {DomainEvent, EmailAddress} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';

describe('lookupByEmail', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when no members exist', () => {
    beforeEach(async () => {
      events = await framework.getAllEvents();
    });

    it('returns none', () => {
      const result = lookupByEmail(faker.internet.email())(events);
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when a member with the given email exists', () => {
    const command = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(command);
      events = await framework.getAllEvents();
    });

    it('returns their member number', () => {
      const result = lookupByEmail(command.email)(events);
      expect(result).toStrictEqual(O.some(command.memberNumber));
    });
  });

  describe('when no member with the given email exists', () => {
    const command = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(command);
      events = await framework.getAllEvents();
    });

    it('returns none', () => {
      const result = lookupByEmail(faker.internet.email())(events);
      expect(result).toStrictEqual(O.none);
    });
  });
});
