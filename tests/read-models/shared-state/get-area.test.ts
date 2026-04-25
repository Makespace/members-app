import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {LinkNumberToEmail} from '../../../src/commands/member-numbers/link-number-to-email';
import {EmailAddress} from '../../../src/types';
import {getSomeOrFail} from '../../helpers';
import {TestFramework, initTestFramework} from '../test-framework';

describe('area', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when area exists', () => {
    it('returns the area', async () => {
      const createArea = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
      };

      await framework.commands.area.create(createArea);

      const area = getSomeOrFail(framework.sharedReadModel.area.get(createArea.id));
      expect(area.id).toStrictEqual(createArea.id);
      expect(area.name).toStrictEqual(createArea.name);
      expect(area.owners).toStrictEqual([]);
      expect(area.equipment).toStrictEqual([]);
      expect(area.email).toStrictEqual(O.none);
    });
  });

  describe('when the area does not exist', () => {
    it('returns none', () => {
      expect(framework.sharedReadModel.area.get(faker.string.uuid() as UUID)).toStrictEqual(
        O.none
      );
    });
  });

  describe('when multiple areas exist', () => {
    it('returns all areas', async () => {
      const firstArea = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
      };
      const secondArea = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
      };

      await framework.commands.area.create(firstArea);
      await framework.commands.area.create(secondArea);

      expect(framework.sharedReadModel.area.getAll()).toEqual(
        expect.arrayContaining([
          expect.objectContaining(firstArea),
          expect.objectContaining(secondArea),
        ])
      );
    });
  });

  describe('when area email is updated', () => {
    it('returns the latest email', async () => {
      const createArea = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
      };
      const email = faker.internet.email() as EmailAddress;

      await framework.commands.area.create(createArea);
      await framework.commands.area.setMailingList({id: createArea.id, email});

      const area = getSomeOrFail(framework.sharedReadModel.area.get(createArea.id));
      expect(area.email).toStrictEqual(O.some(email));
    });

    it('returns none when the email is cleared', async () => {
      const createArea = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
      };

      await framework.commands.area.create(createArea);
      await framework.commands.area.setMailingList({
        id: createArea.id,
        email: faker.internet.email(),
      });
      await framework.commands.area.setMailingList({
        id: createArea.id,
        email: '',
      });

      const area = getSomeOrFail(framework.sharedReadModel.area.get(createArea.id));
      expect(area.email).toStrictEqual(O.none);
    });
  });

  describe('when owners are updated', () => {
    const owner: LinkNumberToEmail = {
      email: faker.internet.email() as EmailAddress,
      memberNumber: faker.number.int({min: 1}) as Int,
      name: undefined,
      formOfAddress: undefined,
    };
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };

    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(owner);
      await framework.commands.area.create(createArea);
      await framework.commands.area.addOwner({
        areaId: createArea.id,
        memberNumber: owner.memberNumber,
      });
    });

    it('returns the owners', () => {
      const area = getSomeOrFail(framework.sharedReadModel.area.get(createArea.id));
      expect(area.owners).toEqual([
        expect.objectContaining({
          memberNumber: owner.memberNumber,
          primaryEmailAddress: owner.email,
        }),
      ]);
    });

    it('does not return removed owners', async () => {
      await framework.commands.area.removeOwner({
        areaId: createArea.id,
        memberNumber: owner.memberNumber,
      });

      const area = getSomeOrFail(framework.sharedReadModel.area.get(createArea.id));
      expect(area.owners).toStrictEqual([]);
    });
  });

  describe('when the area is removed', () => {
    it('returns none', async () => {
      const createArea = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
      };

      await framework.commands.area.create(createArea);
      await framework.commands.area.remove({id: createArea.id});

      expect(framework.sharedReadModel.area.get(createArea.id)).toStrictEqual(O.none);
    });
  });
});
