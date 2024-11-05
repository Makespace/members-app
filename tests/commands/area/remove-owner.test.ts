import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {v4} from 'uuid';
import {arbitraryActor} from '../../helpers';
import {removeOwner} from '../../../src/commands/area/remove-owner';

describe('remove-owner', () => {
  const areaId = v4() as UUID;
  const areaName = faker.commerce.productName() as NonEmptyString;
  const memberNumber = faker.number.int();
  const command = {
    areaId: areaId,
    memberNumber,
    actor: arbitraryActor(),
  };

  describe('when the area does not exist', () => {
    const result = removeOwner.process({
      command,
      events: [],
    });

    it('does nothing', () => {
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the area exists', () => {
    const areaCreated = constructEvent('AreaCreated')({
      id: areaId,
      name: areaName,
    });

    describe('and the member is an owner of it', () => {
      const result = removeOwner.process({
        command,
        events: [
          areaCreated,
          constructEvent('OwnerAdded')({memberNumber, areaId}),
        ],
      });

      it('removes them as owner', () => {
        expect(result).toStrictEqual(
          O.some(
            expect.objectContaining({
              type: 'OwnerRemoved',
              areaId,
              memberNumber,
            })
          )
        );
      });
    });

    describe('and the member was an owner before the area has been removed', () => {
      const result = removeOwner.process({
        command,
        events: [
          areaCreated,
          constructEvent('OwnerAdded')({memberNumber, areaId}),
          constructEvent('AreaRemoved')({id: areaId}),
        ],
      });

      it('does nothing', () => {
        expect(result).toStrictEqual(O.none);
      });
    });

    describe('and the member was never an owner of it', () => {
      const result = removeOwner.process({
        command,
        events: [areaCreated],
      });

      it('does nothing', () => {
        expect(result).toStrictEqual(O.none);
      });
    });

    describe('and the member is no longer an owner of it', () => {
      const result = removeOwner.process({
        command,
        events: [
          areaCreated,
          constructEvent('OwnerAdded')({memberNumber, areaId}),
          constructEvent('OwnerRemoved')({memberNumber, areaId}),
        ],
      });

      it('does nothing', () => {
        expect(result).toStrictEqual(O.none);
      });
    });
  });
});
