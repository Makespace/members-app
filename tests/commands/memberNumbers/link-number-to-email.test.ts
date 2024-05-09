import * as O from 'fp-ts/Option';
import {linkNumberToEmail} from '../../../src/commands/member-numbers/link-number-to-email';
import {faker} from '@faker-js/faker';
import {
  DomainEvent,
  EmailAddress,
  constructEvent,
  isEventOfType,
} from '../../../src/types';
import {pipe} from 'fp-ts/lib/function';
import {shouldNotBeCalled} from '../../should-not-be-called.helper';
describe('linkNumberToEmail', () => {
  const command = {
    email: faker.internet.email() as EmailAddress,
    memberNumber: faker.number.int(),
  };
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
    it.todo('returns none');
  });

  describe('when both the email and member number are new', () => {
    const events: ReadonlyArray<DomainEvent> = [];
    const event = pipe(
      {command, events},
      linkNumberToEmail.process,
      O.filter(isEventOfType('MemberNumberLinkedToEmail')),
      O.getOrElseW(shouldNotBeCalled)
    );

    it('raises an event linking the number and email', () => {
      expect(event.email).toStrictEqual(command.email);
      expect(event.memberNumber).toStrictEqual(command.memberNumber);
    });
  });
});
