import * as O from 'fp-ts/Option';
import {linkNumberToEmail} from '../../../src/commands/member-numbers/link-number-to-email';
import {faker} from '@faker-js/faker';
import {DomainEvent, EmailAddress, constructEvent} from '../../../src/types';
describe('linkNumberToEmail', () => {
  describe('given a member number that already exists', () => {
    const command = {
      email: faker.internet.email() as EmailAddress,
      memberNumber: faker.number.int(),
    };
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
  describe('given an email that is already used', () => {
    it.todo('returns none');
  });
  describe('given a new email and member number', () => {
    it.todo('returns a NumberLinkedToEmail event');
  });
});
