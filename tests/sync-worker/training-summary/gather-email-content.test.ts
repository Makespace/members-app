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
import {insertRecurlySubscription} from '../../helpers';

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
        await insertRecurlySubscription(framework.extDB, {
          email: addTrainerMember.email,
          hasActiveSubscription: true,
        });
        await insertRecurlySubscription(framework.extDB, {
          email: addTrainedMember.email,
          hasActiveSubscription: true,
        });
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
      it('total active members to be 2', () => {
        expect(content.totalActiveMembers).toStrictEqual(2);
      });
      it('counts the active trainer as the equipment active owner', () => {
        expect(content.trainingStatsPerEquipment[0].activeOwnerCount).toStrictEqual(1);
      });
      it('calculates equipment training coverage from active member count', () => {
        expect(
          content.trainingStatsPerEquipment[0].percentageOfActiveMembershipTrained
        ).toStrictEqual(50);
      });
      it('the equipment shows no members awaiting training because there is no training sheet', () => {
        expect(content.trainingStatsPerEquipment[0].awaitingTraining).toBe(
          O.none
        );
      });

      it('there to be 1 piece of equipment', () => {
        expect(content.trainingStatsPerEquipment).toHaveLength(1);
      });

      describe('and an orange and a green piece of equipment', () => {
        beforeEach(async () => {
          await framework.commands.equipment.add({
            id: faker.string.uuid() as UUID,
            name: 'Orange thing' as NonEmptyString,
            areaId: createArea.id,
            category: 'orange',
          });
          await framework.commands.equipment.add({
            id: faker.string.uuid() as UUID,
            name: 'Green thing' as NonEmptyString,
            areaId: createArea.id,
            category: 'green',
          });
          content = await gatherEmailContent(framework.trainingSummaryDeps);
        });

        it('only the red equipment is included', () => {
          expect(content.trainingStatsPerEquipment).toHaveLength(1);
          expect(content.trainingStatsPerEquipment[0].name).toStrictEqual(
            addEquipment.name
          );
        });
      });

      it('the equipment link to be correct', () => {
        expect(
          content.trainingStatsPerEquipment[0].equipmentLink.href
        ).toStrictEqual(
          `${framework.trainingSummaryDeps.conf.PUBLIC_URL}/equipment/${equipmentId}`
        );
      });
    });

    describe('Counting active owners', () => {
      describe('an active owner who is not a trainer for the equipment', () => {
        const owner = {
          memberNumber: faker.number.int(),
          email: faker.internet.email() as EmailAddress,
          name: 'Olive',
          formOfAddress: 'she/her',
        };
        const createArea = {
          id: faker.string.uuid() as UUID,
          name: faker.airline.airport().name as NonEmptyString,
        };
        const addEquipment = {
          id: faker.string.uuid() as UUID,
          name: 'Unowned bench' as NonEmptyString,
          areaId: createArea.id,
        };
        beforeEach(async () => {
          await framework.commands.memberNumbers.linkNumberToEmail(owner);
          await insertRecurlySubscription(framework.extDB, {
            email: owner.email,
            hasActiveSubscription: true,
          });
          await framework.commands.area.create(createArea);
          await framework.commands.equipment.add(addEquipment);
          await framework.commands.area.addOwner({
            memberNumber: owner.memberNumber,
            areaId: createArea.id,
          });
          content = await gatherEmailContent(framework.trainingSummaryDeps);
        });
        it('does not count them as an active owner for the equipment', () => {
          expect(content.trainingStatsPerEquipment[0].activeOwnerCount).toStrictEqual(0);
        });
      });

      describe('a past-due trainer', () => {
        const trainer = {
          memberNumber: faker.number.int(),
          email: faker.internet.email() as EmailAddress,
          name: 'Past Due Pete',
          formOfAddress: 'he/him',
        };
        const createArea = {
          id: faker.string.uuid() as UUID,
          name: faker.airline.airport().name as NonEmptyString,
        };
        const addEquipment = {
          id: faker.string.uuid() as UUID,
          name: 'Past due lathe' as NonEmptyString,
          areaId: createArea.id,
        };
        beforeEach(async () => {
          await framework.commands.memberNumbers.linkNumberToEmail(trainer);
          await insertRecurlySubscription(framework.extDB, {
            email: trainer.email,
            hasActiveSubscription: true,
            hasPastDueInvoice: true,
          });
          await framework.commands.area.create(createArea);
          await framework.commands.equipment.add(addEquipment);
          await framework.commands.area.addOwner({
            memberNumber: trainer.memberNumber,
            areaId: createArea.id,
          });
          await framework.commands.trainers.add({
            memberNumber: trainer.memberNumber,
            equipmentId: addEquipment.id,
          });
          content = await gatherEmailContent(framework.trainingSummaryDeps);
        });
        it('does not count them', () => {
          expect(content.trainingStatsPerEquipment[0].activeOwnerCount).toStrictEqual(0);
        });
      });

      describe('a trainer with no Recurly data', () => {
        const trainer = {
          memberNumber: faker.number.int(),
          email: faker.internet.email() as EmailAddress,
          name: 'No Data Nora',
          formOfAddress: 'she/her',
        };
        const createArea = {
          id: faker.string.uuid() as UUID,
          name: faker.airline.airport().name as NonEmptyString,
        };
        const addEquipment = {
          id: faker.string.uuid() as UUID,
          name: 'Unknown bench' as NonEmptyString,
          areaId: createArea.id,
        };
        beforeEach(async () => {
          await framework.commands.memberNumbers.linkNumberToEmail(trainer);
          await framework.commands.area.create(createArea);
          await framework.commands.equipment.add(addEquipment);
          await framework.commands.area.addOwner({
            memberNumber: trainer.memberNumber,
            areaId: createArea.id,
          });
          await framework.commands.trainers.add({
            memberNumber: trainer.memberNumber,
            equipmentId: addEquipment.id,
          });
          content = await gatherEmailContent(framework.trainingSummaryDeps);
        });
        it('does not count them', () => {
          expect(content.trainingStatsPerEquipment[0].activeOwnerCount).toStrictEqual(0);
        });
      });

      describe('two trainers where only one is active', () => {
        const activeTrainer = {
          memberNumber: faker.number.int(),
          email: faker.internet.email() as EmailAddress,
          name: 'Active Amy',
          formOfAddress: 'she/her',
        };
        const pastDueTrainer = {
          memberNumber: faker.number.int(),
          email: faker.internet.email() as EmailAddress,
          name: 'Past Due Paul',
          formOfAddress: 'he/him',
        };
        const createArea = {
          id: faker.string.uuid() as UUID,
          name: faker.airline.airport().name as NonEmptyString,
        };
        const addEquipment = {
          id: faker.string.uuid() as UUID,
          name: 'Shared mill' as NonEmptyString,
          areaId: createArea.id,
        };
        beforeEach(async () => {
          await framework.commands.memberNumbers.linkNumberToEmail(activeTrainer);
          await framework.commands.memberNumbers.linkNumberToEmail(pastDueTrainer);
          await insertRecurlySubscription(framework.extDB, {
            email: activeTrainer.email,
            hasActiveSubscription: true,
          });
          await insertRecurlySubscription(framework.extDB, {
            email: pastDueTrainer.email,
            hasActiveSubscription: true,
            hasPastDueInvoice: true,
          });
          await framework.commands.area.create(createArea);
          await framework.commands.equipment.add(addEquipment);
          await framework.commands.area.addOwner({
            memberNumber: activeTrainer.memberNumber,
            areaId: createArea.id,
          });
          await framework.commands.area.addOwner({
            memberNumber: pastDueTrainer.memberNumber,
            areaId: createArea.id,
          });
          await framework.commands.trainers.add({
            memberNumber: activeTrainer.memberNumber,
            equipmentId: addEquipment.id,
          });
          await framework.commands.trainers.add({
            memberNumber: pastDueTrainer.memberNumber,
            equipmentId: addEquipment.id,
          });
          content = await gatherEmailContent(framework.trainingSummaryDeps);
        });
        it('counts only the active one', () => {
          expect(content.trainingStatsPerEquipment[0].activeOwnerCount).toStrictEqual(1);
        });
      });

      describe('equipment with no trainers', () => {
        const createArea = {
          id: faker.string.uuid() as UUID,
          name: faker.airline.airport().name as NonEmptyString,
        };
        const addEquipment = {
          id: faker.string.uuid() as UUID,
          name: 'Lonely saw' as NonEmptyString,
          areaId: createArea.id,
        };
        beforeEach(async () => {
          await framework.commands.area.create(createArea);
          await framework.commands.equipment.add(addEquipment);
          content = await gatherEmailContent(framework.trainingSummaryDeps);
        });
        it('shows 0 active owners', () => {
          expect(content.trainingStatsPerEquipment[0].activeOwnerCount).toStrictEqual(0);
        });
      });

      describe('the same active trainer on two machines', () => {
        const trainer = {
          memberNumber: faker.number.int(),
          email: faker.internet.email() as EmailAddress,
          name: 'Dual Duty Dan',
          formOfAddress: 'he/him',
        };
        const createArea = {
          id: faker.string.uuid() as UUID,
          name: faker.airline.airport().name as NonEmptyString,
        };
        const addFirstEquipment = {
          id: faker.string.uuid() as UUID,
          name: 'Alpha machine' as NonEmptyString,
          areaId: createArea.id,
        };
        const addSecondEquipment = {
          id: faker.string.uuid() as UUID,
          name: 'Beta machine' as NonEmptyString,
          areaId: createArea.id,
        };
        beforeEach(async () => {
          await framework.commands.memberNumbers.linkNumberToEmail(trainer);
          await insertRecurlySubscription(framework.extDB, {
            email: trainer.email,
            hasActiveSubscription: true,
          });
          await framework.commands.area.create(createArea);
          await framework.commands.equipment.add(addFirstEquipment);
          await framework.commands.equipment.add(addSecondEquipment);
          await framework.commands.area.addOwner({
            memberNumber: trainer.memberNumber,
            areaId: createArea.id,
          });
          await framework.commands.trainers.add({
            memberNumber: trainer.memberNumber,
            equipmentId: addFirstEquipment.id,
          });
          await framework.commands.trainers.add({
            memberNumber: trainer.memberNumber,
            equipmentId: addSecondEquipment.id,
          });
          content = await gatherEmailContent(framework.trainingSummaryDeps);
        });
        it('counts them on each machine', () => {
          expect(content.trainingStatsPerEquipment[0].name).toStrictEqual('Alpha machine');
          expect(content.trainingStatsPerEquipment[0].activeOwnerCount).toStrictEqual(1);
          expect(content.trainingStatsPerEquipment[1].name).toStrictEqual('Beta machine');
          expect(content.trainingStatsPerEquipment[1].activeOwnerCount).toStrictEqual(1);
        });
      });

      describe('a trainer in one area and equipment in another', () => {
        const trainer = {
          memberNumber: faker.number.int(),
          email: faker.internet.email() as EmailAddress,
          name: 'Single Area Sue',
          formOfAddress: 'she/her',
        };
        const createTrainedArea = {
          id: faker.string.uuid() as UUID,
          name: faker.airline.airport().name as NonEmptyString,
        };
        const createEmptyArea = {
          id: faker.string.uuid() as UUID,
          name: faker.airline.airport().name as NonEmptyString,
        };
        const addTrainedEquipment = {
          id: faker.string.uuid() as UUID,
          name: 'Alpha machine' as NonEmptyString,
          areaId: createTrainedArea.id,
        };
        const addUnsupportedEquipment = {
          id: faker.string.uuid() as UUID,
          name: 'Beta machine' as NonEmptyString,
          areaId: createEmptyArea.id,
        };
        beforeEach(async () => {
          await framework.commands.memberNumbers.linkNumberToEmail(trainer);
          await insertRecurlySubscription(framework.extDB, {
            email: trainer.email,
            hasActiveSubscription: true,
          });
          await framework.commands.area.create(createTrainedArea);
          await framework.commands.area.create(createEmptyArea);
          await framework.commands.equipment.add(addTrainedEquipment);
          await framework.commands.equipment.add(addUnsupportedEquipment);
          await framework.commands.area.addOwner({
            memberNumber: trainer.memberNumber,
            areaId: createTrainedArea.id,
          });
          await framework.commands.trainers.add({
            memberNumber: trainer.memberNumber,
            equipmentId: addTrainedEquipment.id,
          });
          content = await gatherEmailContent(framework.trainingSummaryDeps);
        });
        it('only the machine with the trainer shows an active owner', () => {
          expect(content.trainingStatsPerEquipment[0].name).toStrictEqual('Alpha machine');
          expect(content.trainingStatsPerEquipment[0].activeOwnerCount).toStrictEqual(1);
          expect(content.trainingStatsPerEquipment[1].name).toStrictEqual('Beta machine');
          expect(content.trainingStatsPerEquipment[1].activeOwnerCount).toStrictEqual(0);
        });
      });

      describe('an obsolete machine with an active trainer', () => {
        const trainer = {
          memberNumber: faker.number.int(),
          email: faker.internet.email() as EmailAddress,
          name: 'Retired Equipment Ray',
          formOfAddress: 'he/him',
        };
        const createArea = {
          id: faker.string.uuid() as UUID,
          name: faker.airline.airport().name as NonEmptyString,
        };
        const addEquipment = {
          id: faker.string.uuid() as UUID,
          name: 'Old bench' as NonEmptyString,
          areaId: createArea.id,
        };
        beforeEach(async () => {
          await framework.commands.memberNumbers.linkNumberToEmail(trainer);
          await insertRecurlySubscription(framework.extDB, {
            email: trainer.email,
            hasActiveSubscription: true,
          });
          await framework.commands.area.create(createArea);
          await framework.commands.equipment.add(addEquipment);
          await framework.commands.area.addOwner({
            memberNumber: trainer.memberNumber,
            areaId: createArea.id,
          });
          await framework.commands.trainers.add({
            memberNumber: trainer.memberNumber,
            equipmentId: addEquipment.id,
          });
          await framework.commands.equipment.markObsolete({id: addEquipment.id});
          content = await gatherEmailContent(framework.trainingSummaryDeps);
        });
        it('still lists the machine with its active owner count', () => {
          expect(content.trainingStatsPerEquipment).toHaveLength(1);
          expect(content.trainingStatsPerEquipment[0].activeOwnerCount).toStrictEqual(1);
        });
      });
    });
  });
});
