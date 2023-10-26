import * as O from 'fp-ts/Option';
import {createArea} from '../../src/commands/create-area';
import {faker} from '@faker-js/faker';
import {constructEvent} from '../../src/types';
import {NonEmptyString} from 'io-ts-types';
import {Actor} from '../../src/types/actor';
import {arbitraryUser} from '../types/user.helper';

describe('create-area', () => {
  describe('process', () => {
    describe('when the area does not yet exist', () => {
      const areaName = faker.commerce.productName() as NonEmptyString;
      const areaDescription = faker.commerce.productDescription();
      const result = createArea.process({
        command: {
          name: areaName,
          description: areaDescription,
        },
        events: [],
      });
      it('creates the area', () => {
        expect(result).toStrictEqual(
          O.some(
            expect.objectContaining({
              type: 'AreaCreated',
              name: areaName,
              description: areaDescription,
            })
          )
        );
      });
    });

    describe('when the area already exists', () => {
      const areaName = faker.commerce.productName() as NonEmptyString;
      const areaDescription = faker.commerce.productDescription();
      const result = createArea.process({
        command: {
          name: areaName,
          description: areaDescription,
        },
        events: [
          constructEvent('AreaCreated')({
            name: areaName,
            description: areaDescription,
          }),
        ],
      });
      it('does nothing', () => {
        expect(result).toStrictEqual(O.none);
      });
    });

    describe.skip('isAuthorized', () => {
      const userToBeSuperUser = arbitraryUser();
      it.each([
        [
          'admin via token',
          true,
          {tag: 'token', token: 'admin'} satisfies Actor,
          [],
        ],
        [
          'super user',
          true,
          {tag: 'user', user: userToBeSuperUser} satisfies Actor,
          [
            constructEvent('SuperUserDeclared')({
              memberNumber: userToBeSuperUser.memberNumber,
              declaredAt: faker.date.anytime(),
            }),
          ],
        ],
        [
          'other user',
          false,
          {tag: 'user', user: arbitraryUser()} satisfies Actor,
          [],
        ],
      ])('%s: %s', (_, expected, actor, events) => {
        expect(createArea.isAuthorized({actor, events})).toBe(expected);
      });
    });
  });
});
