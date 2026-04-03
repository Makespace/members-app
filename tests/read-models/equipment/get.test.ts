import {faker} from '@faker-js/faker';
import {DomainEvent, EmailAddress} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {get} from '../../../src/read-models/equipment/get';
import {pipe} from 'fp-ts/lib/function';
import {getSomeOrFail} from '../../helpers';
import {Int} from 'io-ts';
import { LinkNumberToEmail } from '../../../src/commands/member-numbers/link-number-to-email';
import { MarkMemberTrained } from '../../../src/commands/trainers/mark-member-trained';
import { AddTrainer } from '../../../src/commands/trainers/add-trainer';
import { AddEquipment } from '../../../src/commands/equipment/add';
import { CreateArea } from '../../../src/commands/area/create';

describe('get', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  describe('when equipment has a trainer and trained users', () => {
    const createArea: CreateArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const addEquipment: AddEquipment = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: createArea.id,
    };
    const trainer: LinkNumberToEmail = {
      email: faker.internet.email() as EmailAddress,
      memberNumber: faker.number.int() as Int,
      name: undefined,
      formOfAddress: undefined
    };
    const addTrainer: AddTrainer = {
      memberNumber: trainer.memberNumber,
      equipmentId: addEquipment.id,
    };
    const trainedMember: LinkNumberToEmail = {
      email: faker.internet.email() as EmailAddress,
      memberNumber: faker.number.int() as Int,
      name: undefined,
      formOfAddress: undefined
    };
    const markTrained: MarkMemberTrained = {
      equipmentId: addEquipment.id,
      memberNumber: trainedMember.memberNumber as Int,
    };
    beforeEach(async () => {
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.memberNumbers.linkNumberToEmail(trainer);
      await framework.commands.trainers.add(addTrainer);
      await framework.commands.memberNumbers.linkNumberToEmail(trainedMember);
      await framework.commands.trainers.markTrained(markTrained);
      events = await framework.getAllEvents();
    });

    it('returns the equipment', () => {
      const equipment = pipe(addEquipment.id, get(events), getSomeOrFail);
      expect(equipment.id).toStrictEqual(addEquipment.id);
    });

    it('returns the trainer', () => {
      const equipment = pipe(addEquipment.id, get(events), getSomeOrFail);
      expect(equipment.trainers[0]).toStrictEqual(addTrainer.memberNumber);
    });

    it('returns the trained users', () => {
      const equipment = pipe(addEquipment.id, get(events), getSomeOrFail);
      expect(equipment.trainedMembers).toHaveLength(1);
      expect(equipment.trainedMembers[0]).toStrictEqual(
        markTrained.memberNumber
      );
    });
  });
});
