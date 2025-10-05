import {faker} from '@faker-js/faker';
import {
  EmailContent,
  gatherEmailContent,
} from '../../../src/sync-worker/training-summary/gather-email-content';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {UUID} from 'io-ts-types/lib/UUID';
import {EmailAddress} from '../../../src/types/email-address';
import {Int} from 'io-ts';
import {NonEmptyString} from 'io-ts-types';
import * as O from 'fp-ts/Option';

describe('Training summary', () => {
  let framework: TestFramework;
  let content: EmailContent;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });
  describe('Gather email content', () => {
    describe('The database is empty', () => {
      beforeEach(async () => {
        content = await gatherEmailContent(framework.trainingSummaryDeps);
      });
      it('members joined within 30 days to be 0', () => {
        expect(content.membersJoinedWithin30Days).toStrictEqual(0);
      });
      it('total active members to be 0', () => {
        expect(content.totalActiveMembers).toStrictEqual(0);
      });
      it('there is no equipment', () => {
        expect(content.trainingStatsPerEquipment).toHaveLength(0);
      });
    });
    describe('Add 1 piece of equipment', () => {
      const equipmentId = faker.string.uuid() as UUID;
      const addTrainerMember = {
        memberNumber: faker.number.int(),
        email: faker.internet.email() as EmailAddress,
        name: 'Bean',
        formOfAddress: 'he/him',
      };
      const addTrainedMember = {
        memberNumber: faker.number.int() as Int,
        email: faker.internet.email() as EmailAddress,
        name: 'Bob',
        formOfAddress: 'he/him',
      };
      const createArea = {
        id: faker.string.uuid() as UUID,
        name: faker.airline.airport().name as NonEmptyString,
      };
      const addEquipment = {
        id: equipmentId,
        name: faker.science.chemicalElement().name as NonEmptyString,
        areaId: createArea.id,
      };
      const addOwner = {
        memberNumber: addTrainerMember.memberNumber,
        areaId: createArea.id,
      };
      const addTrainer = {
        memberNumber: addTrainerMember.memberNumber,
        equipmentId: equipmentId,
      };
      const markTrained = {
        equipmentId: equipmentId,
        memberNumber: addTrainedMember.memberNumber,
      };
      // const addTrainingSheet = {
      //   equipmentId,
      //   trainingSheetId: 'testTrainingSheetId',
      // };

      beforeEach(async () => {
        await framework.commands.memberNumbers.linkNumberToEmail(
          addTrainerMember
        );
        await framework.commands.memberNumbers.linkNumberToEmail(
          addTrainedMember
        );
        await framework.commands.area.create(createArea);
        await framework.commands.equipment.add(addEquipment);
        await framework.commands.area.addOwner(addOwner);
        await framework.commands.trainers.add(addTrainer);
        await framework.commands.trainers.markTrained(markTrained);

        content = await gatherEmailContent(framework.trainingSummaryDeps);
      });

      it('members joined within 30 days to be 2', () => {
        expect(content.membersJoinedWithin30Days).toStrictEqual(2);
      });
      it.todo('total active members to be 2'); // expect(content.totalActiveMembers).toStrictEqual(2); // Needs recurly mock
      it('the equipment shows no members awaiting training because there is no training sheet', () => {
        expect(content.trainingStatsPerEquipment[0].awaitingTraining).toBe(
          O.none
        );
      });

      it('there to be 1 piece of equipment', () => {
        expect(content.trainingStatsPerEquipment).toHaveLength(1);
      });

      it('the equipment link to be correct', () => {
        expect(
          content.trainingStatsPerEquipment[0].equipmentLink.href
        ).toStrictEqual(
          `${framework.trainingSummaryDeps.conf.PUBLIC_URL}/equipment/${equipmentId}`
        );
      });
    });
  });
});
