import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {v4} from 'uuid';
import {arbitraryActor} from '../../helpers';
import {addOwner} from '../../../src/commands/area/add-owner';

describe('add-owner', () => {
  const areaId = v4() as UUID;
  const areaName = faker.commerce.productName() as NonEmptyString;
  const memberNumber = faker.number.int();
  const command = {
    areaId: areaId,
    memberNumber,
    actor: arbitraryActor(),
  };

  const areaCreated = constructEvent('AreaCreated')({
    id: areaId,
    name: areaName,
  });
  const areaRemoved = constructEvent('AreaRemoved')({
    id: areaId,
  });
  const ownerAdded = constructEvent('OwnerAdded')({memberNumber, areaId});
  const ownerRemoved = constructEvent('OwnerRemoved')({memberNumber, areaId});

  describe('when the area does not exist', () => {
    const result = addOwner.process({
      command,
      events: [],
    });

    it('does nothing', () => {
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the area has been removed', () => {
    const result = addOwner.process({
      command,
      events: [areaCreated, areaRemoved],
    });

    it('does nothing', () => {
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the area exists', () => {
    describe('and the member was never an owner of it', () => {
      const result = addOwner.process({
        command,
        events: [areaCreated],
      });

      it('adds them as owner', () => {
        expect(result).toStrictEqual(
          O.some(
            expect.objectContaining({
              type: 'OwnerAdded',
              areaId,
              memberNumber,
            })
          )
        );
      });
    });

    describe('and the member is no longer an owner of it', () => {
      const result = addOwner.process({
        command,
        events: [areaCreated, ownerAdded, ownerRemoved],
      });

      it('adds them as owner', () => {
        expect(result).toStrictEqual(
          O.some(
            expect.objectContaining({
              type: 'OwnerAdded',
              areaId,
              memberNumber,
            })
          )
        );
      });
    });

    describe('and the member is an owner', () => {
      const result = addOwner.process({
        command,
        events: [areaCreated, ownerAdded],
      });

      it('does nothing', () => {
        expect(result).toStrictEqual(O.none);
      });
    });
  });
});
