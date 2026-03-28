import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {v4} from 'uuid';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import {removeOwner} from '../../../src/commands/area/remove-owner';
import { initTestFramework, TestFramework } from '../../read-models/test-framework';
import { pipe } from 'fp-ts/lib/function';

describe('remove-owner', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  const areaId = v4() as UUID;
  const areaName = faker.commerce.productName() as NonEmptyString;
  const unrelatedAreaName = faker.commerce.productName() as NonEmptyString;
  const memberNumber = faker.number.int();
  const command = {
    areaId: areaId,
    memberNumber,
    actor: arbitraryActor(),
  };

  const unreleatedEvent = constructEvent('AreaCreated')({
    id: v4() as UUID,
    name: unrelatedAreaName,
    actor: arbitraryActor(),
  });

  describe('when the area does not exist', () => {
    it('does nothing', async () => {
      const result = pipe(
        await removeOwner.process({
          command,
          events: [],
          deps: framework,
        })(),
        getRightOrFail,
      );
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the area exists', () => {
    const areaCreated = constructEvent('AreaCreated')({
      id: areaId,
      name: areaName,
      actor: arbitraryActor(),
    });

    describe('and the member is an owner of it', () => {
      it('removes them as owner', async () => {
        const result = pipe(
          await removeOwner.process({
            command,
            events: [
              areaCreated,
              constructEvent('OwnerAdded')({
                memberNumber,
                areaId,
                actor: arbitraryActor(),
              }),
              unreleatedEvent,
            ],
            deps: framework,
          })(),
          getRightOrFail
        );
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
      it('does nothing', async () => {
        const result = pipe(
          await removeOwner.process({
            command,
            events: [
              areaCreated,
              constructEvent('OwnerAdded')({
                memberNumber,
                areaId,
                actor: arbitraryActor(),
              }),
              constructEvent('AreaRemoved')({id: areaId, actor: arbitraryActor()}),
            ],
            deps: framework,
          })(),
          getRightOrFail
        );
        expect(result).toStrictEqual(O.none);
      });
    });

    describe('and the member was never an owner of it', () => {
      it('does nothing', async () => {
        const result = pipe(
          await removeOwner.process({
            command,
            events: [areaCreated],
            deps: framework,
          })(),
          getRightOrFail
        );
        expect(result).toStrictEqual(O.none);
      });
    });

    describe('and the member is no longer an owner of it', () => {
      it('does nothing', async () => {
        const result = pipe(
          await removeOwner.process({
            command,
            events: [
              areaCreated,
              constructEvent('OwnerAdded')({
                memberNumber,
                areaId,
                actor: arbitraryActor(),
              }),
              constructEvent('OwnerRemoved')({
                memberNumber,
                areaId,
                actor: arbitraryActor(),
              }),
            ],
            deps: framework,
          })(),
          getRightOrFail
        );
        expect(result).toStrictEqual(O.none);
      });
    });
  });
});
