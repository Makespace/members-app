import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Int} from 'io-ts';
import * as O from 'fp-ts/Option';
import {EmailAddress} from '../../../src/types';
import {getSomeOrFail} from '../../helpers';
import {TestFramework, initTestFramework} from '../test-framework';

describe('mark equipment obsolete (read model)', () => {
  let framework: TestFramework;
  const equipmentId = faker.string.uuid() as UUID;
  const areaId = faker.string.uuid() as UUID;
  const trainer = {
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
  };
  const trained = {
    memberNumber: faker.number.int() as Int,
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
  };

  const getEquipment = () =>
    getSomeOrFail(framework.sharedReadModel.equipment.get(equipmentId));

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail(trainer);
    await framework.commands.memberNumbers.linkNumberToEmail(trained);
    await framework.commands.area.create({
      id: areaId,
      name: faker.airline.airport().name as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: faker.science.chemicalElement().name as NonEmptyString,
      areaId,
    });
    await framework.commands.area.addOwner({
      memberNumber: trainer.memberNumber,
      areaId,
    });
    await framework.commands.trainers.add({
      memberNumber: trainer.memberNumber,
      equipmentId,
    });
    await framework.commands.trainers.markTrained({
      equipmentId,
      memberNumber: trained.memberNumber,
    });
  });

  afterEach(() => framework.close());

  it('is not obsolete before the event', () => {
    expect(getEquipment().removedAt).toStrictEqual(O.none);
  });

  describe('after marking it obsolete', () => {
    beforeEach(async () => {
      await framework.commands.equipment.markObsolete({id: equipmentId});
    });

    it('sets removedAt', () => {
      expect(O.isSome(getEquipment().removedAt)).toBe(true);
    });

    it('keeps the trainer and trained-member records', () => {
      const equipment = getEquipment();
      expect(equipment.trainers).toHaveLength(1);
      expect(equipment.trainedMembers).toHaveLength(1);
    });
  });
});
