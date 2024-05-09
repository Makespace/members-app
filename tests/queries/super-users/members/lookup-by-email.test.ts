import * as O from 'fp-ts/Option';
import {lookupByEmail} from '../../../../src/queries/members/lookup-by-email';
import {faker} from '@faker-js/faker';
import {DomainEvent} from '../../../../src/types';

describe('lookupByEmail', () => {
  describe('when no members exist', () => {
    const events: ReadonlyArray<DomainEvent> = [];
    const result = lookupByEmail(faker.internet.email())(events);
    it('returns none', () => {
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when a member with the given email exists', () => {
    it.todo('returns their member number');
  });

  describe('when no member with the given email exists', () => {
    it.todo('returns none');
  });
});
