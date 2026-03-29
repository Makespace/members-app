import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {constructEvent} from '../../../src/types';
import {revoke} from '../../../src/commands/super-user/revoke';
import {arbitraryActor, getTaskEitherRightOrFail} from '../../helpers';

describe('revoke-super-user', () => {
  describe('when the member is currently not a super user', () => {
    const memberNumber = faker.number.int();
    it('does nothing', async () => {
      const result = await getTaskEitherRightOrFail(
        revoke.process({
          command: {
            memberNumber,
            actor: arbitraryActor(),
          },
          events: [],
        })
      );

      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the member is already a super user', () => {
    const memberNumber = faker.number.int();
    it('revokes their status', async () => {
      const result = await getTaskEitherRightOrFail(
        revoke.process({
          command: {
            memberNumber,
            actor: arbitraryActor(),
          },
          events: [
            constructEvent('SuperUserDeclared')({
              memberNumber,
              actor: arbitraryActor(),
            }),
          ],
        })
      );

      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({type: 'SuperUserRevoked', memberNumber})
        )
      );
    });
  });

  describe('when the member was re-declared as a super user', () => {
    const memberNumber = faker.number.int();
    it('revokes their status', async () => {
      const result = await getTaskEitherRightOrFail(
        revoke.process({
          command: {
            memberNumber,
            actor: arbitraryActor(),
          },
          events: [
            constructEvent('SuperUserDeclared')({
              memberNumber,
              actor: arbitraryActor(),
            }),
            constructEvent('SuperUserRevoked')({
              memberNumber,
              actor: arbitraryActor(),
            }),
            constructEvent('SuperUserDeclared')({
              memberNumber,
              actor: arbitraryActor(),
            }),
          ],
        })
      );

      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({type: 'SuperUserRevoked', memberNumber})
        )
      );
    });
  });
});
