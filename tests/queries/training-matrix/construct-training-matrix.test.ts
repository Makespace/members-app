import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import { getFullQuizResultsForMember } from '../../../src/read-models/external-state/equipment-quiz';
import { expectMatchSecondsPrecision, getRightOrFail, getSomeOrFail } from '../../helpers';
import { constructTrainingMatrix } from '../../../src/queries/training-matrix/construct-view-model';
import { faker } from '@faker-js/faker';
import { LinkNumberToEmail } from '../../../src/commands/member-numbers/link-number-to-email';
import { EmailAddress } from '../../../src/types';
import { MemberNumber } from '../../../src/types/member-number';
import { TrainingMatrix } from '../../../src/queries/training-matrix/render';
import { CreateArea } from '../../../src/commands/area/create';
import { NonEmptyString, UUID } from 'io-ts-types';
import { AddEquipment } from '../../../src/commands/equipment/add';
import { EquipmentId } from '../../../src/types/equipment-id';
import { SheetDataTable } from '../../../src/sync-worker/google/sheet-data-table';
import { RegisterTrainingSheet } from '../../../src/commands/equipment/register-training-sheet';
import * as O from 'fp-ts/Option';
import { Int } from 'io-ts';
import { MarkMemberTrainedBy } from '../../../src/commands/trainers/mark-member-trained-by';
import { DateTime, Duration } from 'luxon';
import { AddOwner } from '../../../src/commands/area/add-owner';
import { AddTrainer } from '../../../src/commands/trainers/add-trainer';

const _getTrainingMatrix = (framework: TestFramework) => async (memberNumber: MemberNumber) => {
  return constructTrainingMatrix(
    getSomeOrFail(framework.sharedReadModel.members.get(memberNumber)),
    framework.sharedReadModel,
    getRightOrFail(
      await getFullQuizResultsForMember(framework, memberNumber)()
    )
  );
}

describe('construct-training-matrix', () => {
  let framework: TestFramework;
  let getTrainingMatrix: ReturnType<typeof _getTrainingMatrix>;

  type TrainingSheet = RegisterTrainingSheet & {sheetName: string};

  const metalshop: CreateArea = {
    id: faker.string.uuid() as UUID,
    name: 'Metal Shop' as NonEmptyString,
  };
  const metalMill: AddEquipment = {
    id: faker.string.uuid() as EquipmentId,
    name: 'Metal Mill' as NonEmptyString,
    areaId: metalshop.id
  };
  const metalMillSheet: TrainingSheet = {
    trainingSheetId: faker.string.hexadecimal({ length: 16 }),
    equipmentId: metalMill.id,
    sheetName: 'Form Responses 1',
  };
  const existingTrainerMetalMill: LinkNumberToEmail = {
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
    name: faker.animal.cat(),
    formOfAddress: faker.person.prefix(),
  };
  const metalCnc: AddEquipment = {
    id: faker.string.uuid() as EquipmentId,
    name: 'Metal CNC' as NonEmptyString,
    areaId: metalshop.id
  };
  const metalCncSheet: TrainingSheet = {
    trainingSheetId: faker.string.hexadecimal({ length: 16 }),
    equipmentId: metalCnc.id,
    sheetName: 'Form Responses 1',
  };
  const woodshop: CreateArea = {
    id: faker.string.uuid() as UUID,
    name: 'Wood Shop' as NonEmptyString,
  };
  const mitreSaw: AddEquipment = {
    id: faker.string.uuid() as EquipmentId,
    name: 'Mitre Saw' as NonEmptyString,
    areaId: woodshop.id
  };
  const mitreSawSheet: TrainingSheet = {
    trainingSheetId: faker.string.hexadecimal({ length: 16 }),
    equipmentId: mitreSaw.id,
    sheetName: 'Form Responses 1',
  };
  const bandSaw: AddEquipment = {
    id: faker.string.uuid() as EquipmentId,
    name: 'Band Saw' as NonEmptyString,
    areaId: woodshop.id
  };
  const bandSawSheet: TrainingSheet = {
    trainingSheetId: faker.string.hexadecimal({ length: 16 }),
    equipmentId: bandSaw.id,
    sheetName: 'Form Responses 1',
  };
  beforeEach(async () => {
    framework = await initTestFramework();
    getTrainingMatrix = _getTrainingMatrix(framework);

    // Setup the available equipment.
    await framework.commands.area.create(metalshop);
    await framework.commands.equipment.add(metalMill);
    await framework.commands.equipment.trainingSheet(metalMillSheet);
    await framework.commands.equipment.add(metalCnc);
    await framework.commands.equipment.trainingSheet(metalCncSheet);
    await framework.commands.area.create(woodshop);
    await framework.commands.equipment.add(mitreSaw);
    await framework.commands.equipment.trainingSheet(mitreSawSheet);
    await framework.commands.equipment.add(bandSaw);
    await framework.commands.equipment.trainingSheet(bandSawSheet);

    await framework.commands.memberNumbers.linkNumberToEmail(existingTrainerMetalMill);
    await framework.commands.area.addOwner({
      areaId: metalshop.id,
      memberNumber: existingTrainerMetalMill.memberNumber
    });
    await framework.commands.trainers.add({
      equipmentId: metalMill.id,
      memberNumber: existingTrainerMetalMill.memberNumber,
    });
  });
  afterEach(() => {
    framework.close();
  });

  describe('new user', () => {
    const user: LinkNumberToEmail = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
      name: faker.animal.cat(),
      formOfAddress: faker.person.prefix(),
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(user);
    });
    describe('get training matrix', () => {
      let matrix: TrainingMatrix;
      beforeEach(async () => {
        matrix = await getTrainingMatrix(user.memberNumber);
      });

      it('is empty', () => {
        expect(matrix).toHaveLength(0);
      });
    });

    describe('user is marked as a trainer for a piece of equipment they aren\'t trained on', () => {
      const markedAsTrainer: AddTrainer = {
        equipmentId: metalCnc.id,
        memberNumber: user.memberNumber
      };
      let trainingMatrix: TrainingMatrix;
      beforeEach(async () => {
        await framework.commands.trainers.add(markedAsTrainer);
        trainingMatrix = await getTrainingMatrix(user.memberNumber);
      });

      // Since the user isn't an owner their trainer status isn't valid.

      it('user has no equipment shown', () => {
        expect(trainingMatrix).toHaveLength(0);
      });
    });

    describe('user is marked as a trainer and owner for a piece of equipment they aren\'t trained on', () => {
      // User hasn't done the training at all!
      // In future we can flag cases like this
      const markedAsOwner: AddOwner = {
        areaId: metalshop.id,
        memberNumber: user.memberNumber
      };
      const markedAsTrainer: AddTrainer = {
        // user must be an owner to be a trainer.
        equipmentId: metalCnc.id,
        memberNumber: user.memberNumber
      };
      let trainingMatrix: TrainingMatrix;
      beforeEach(async () => {
        await framework.commands.area.addOwner(markedAsOwner);
        await framework.commands.trainers.add(markedAsTrainer);
        trainingMatrix = await getTrainingMatrix(user.memberNumber);
      });

      it('user has both bits of metal shop equipment shown sorted by equipment name', () => {
        expect(trainingMatrix).toHaveLength(2);
        expect(trainingMatrix[0].equipment_name).toStrictEqual(metalCnc.name);
        expect(trainingMatrix[0].equipment_id).toStrictEqual(metalCnc.id);

        expect(trainingMatrix[1].equipment_name).toStrictEqual(metalMill.name);
        expect(trainingMatrix[1].equipment_id).toStrictEqual(metalMill.id);
      });

      it('user appears as an owner for all the equipment', () => {
        expect(trainingMatrix.every(r => O.isSome(r.is_owner))).toStrictEqual(true);
      });

      it('user does not appear as trained for any equipment', () => {
        expect(trainingMatrix.some(r => O.isSome(r.is_trained))).toStrictEqual(false);
      });

      it('user appears as a trainer for the metal cnc', () => {
        const metalCncRow = trainingMatrix.find(r => r.equipment_id === metalCnc.id)!;
        expect(O.isSome(metalCncRow.is_trainer)).toStrictEqual(true);
      });

      it('user does not appear as having done the quiz for any equipment', () => {
        for (const row of trainingMatrix) {
          expect(row.equipment_quiz).toStrictEqual({
            passedAt: [],
            attempted: [],
          });
        }
      });
    });

    describe('user is marked as an owner for metalshop and woodshop', () => {
      const markedAsMetalOwner: AddOwner = {
        areaId: metalshop.id,
        memberNumber: user.memberNumber
      };
      const markedAsWoodOwner: AddOwner = {
        areaId: woodshop.id,
        memberNumber: user.memberNumber
      };
      let trainingMatrix: TrainingMatrix;
      beforeEach(async () => {
        await framework.commands.area.addOwner(markedAsMetalOwner);
        await framework.commands.area.addOwner(markedAsWoodOwner);
        trainingMatrix = await getTrainingMatrix(user.memberNumber);
      });
      it('user has all bits of metal and wood shop equipment shown sorted by area then equipment name', () => {
        expect(trainingMatrix).toHaveLength(4);
        expect(trainingMatrix[0].equipment_name).toStrictEqual(metalCnc.name);
        expect(trainingMatrix[0].equipment_id).toStrictEqual(metalCnc.id);

        expect(trainingMatrix[1].equipment_name).toStrictEqual(metalMill.name);
        expect(trainingMatrix[1].equipment_id).toStrictEqual(metalMill.id);

        expect(trainingMatrix[2].equipment_name).toStrictEqual(bandSaw.name);
        expect(trainingMatrix[2].equipment_id).toStrictEqual(bandSaw.id);

        expect(trainingMatrix[3].equipment_name).toStrictEqual(mitreSaw.name);
        expect(trainingMatrix[3].equipment_id).toStrictEqual(mitreSaw.id);
      });

      it('user appears as an owner for all the equipment', () => {
        expect(trainingMatrix.every(r => O.isSome(r.is_owner))).toStrictEqual(true);
      });

      it('user does not appear as trained for any equipment', () => {
        expect(trainingMatrix.some(r => O.isSome(r.is_trained))).toStrictEqual(false);
      });

      it('user does not appear as a trainer for any equipment', () => {
        expect(trainingMatrix.some(r => O.isSome(r.is_trainer))).toStrictEqual(false);
      });

      it('user does not appear as having done the quiz for any equipment', () => {
        for (const row of trainingMatrix) {
          expect(row.equipment_quiz).toStrictEqual({
            passedAt: [],
            attempted: [],
          });
        }
      });
    });

    describe('user is marked as trained without doing quiz', () => {
      // In future we can flag cases like this
      const trainedOnMetalMill: MarkMemberTrainedBy = {
        equipmentId: metalMill.id,
        memberNumber: user.memberNumber as Int,
        trainedByMemberNumber: existingTrainerMetalMill.memberNumber as Int,
        trainedAt:faker.date.recent(),
      };
      let trainingMatrix: TrainingMatrix;
      beforeEach(async () => {
        await framework.commands.trainers.markMemberTrainedBy({
          ...trainedOnMetalMill,
          actor: {
            tag: "user",
            user: {
              emailAddress: existingTrainerMetalMill.email,
              memberNumber: existingTrainerMetalMill.memberNumber,
            }
          },
        });
        trainingMatrix = await getTrainingMatrix(user.memberNumber);
      });

      it('user only has a single bit of equipment shown', () => {
        expect(trainingMatrix).toHaveLength(1);
        expect(trainingMatrix[0].equipment_name).toStrictEqual(metalMill.name);
        expect(trainingMatrix[0].equipment_id).toStrictEqual(metalMill.id);
      });

      it('user appears as trained', () => {
        expectMatchSecondsPrecision(trainedOnMetalMill.trainedAt)(getSomeOrFail(trainingMatrix[0].is_trained));
      });

      it('user does not appear as a trainer', () => {
        expect(O.isSome(trainingMatrix[0].is_trainer)).toStrictEqual(false);
      });

      it('user does not appear as an owner', () => {
        expect(O.isSome(trainingMatrix[0].is_owner)).toStrictEqual(false);
      });

      it('user does not appear as having done the quiz', () => {
        expect(trainingMatrix[0].equipment_quiz).toStrictEqual({
          passedAt: [],
          attempted: [],
        });
      });

    });

    describe('user passes the quiz for the metal mill', () => {
      const passedMetalMillQuiz: SheetDataTable['rows'][0] = {
        sheet_id: metalMillSheet.trainingSheetId,
        sheet_name: metalMillSheet.sheetName,
        row_index: 0,
        response_submitted: faker.date.past(),
        member_number_provided: user.memberNumber,
        email_provided: user.email,
        score: 10,
        max_score: 10,
        percentage: 100,
        cached_at: new Date(),
      };
      beforeEach(async () => {
        await framework.storeTrainingSheetRowsRead([
          passedMetalMillQuiz
        ])();
      });

      it('training matrix contains a row for the metal mill', async () => {
        const matrix = await getTrainingMatrix(user.memberNumber);
        expect(matrix).toHaveLength(1);
        const millRow = matrix[0];
        expect(millRow.equipment_name).toStrictEqual(metalMill.name);
        expect(millRow.equipment_id).toStrictEqual(metalMill.id);
        expect(millRow.is_owner).toStrictEqual(O.none);
        expect(millRow.is_trained).toStrictEqual(O.none);
        expect(millRow.is_trainer).toStrictEqual(O.none);
        expect(millRow.equipment_quiz.attempted).toHaveLength(0);
        expect(millRow.equipment_quiz.passedAt).toStrictEqual([passedMetalMillQuiz.response_submitted]);
      });

      describe('user is marked as trained on the metal mill', () => {
        const trainedOnMetalMill: MarkMemberTrainedBy = {
          equipmentId: metalMill.id,
          memberNumber: user.memberNumber as Int,
          trainedByMemberNumber: existingTrainerMetalMill.memberNumber as Int,
          trainedAt: DateTime.fromJSDate(passedMetalMillQuiz.response_submitted).plus(Duration.fromObject({days: 1})).toJSDate(),
        };

        beforeEach(async () => {
          await framework.commands.trainers.markMemberTrainedBy({
            ...trainedOnMetalMill,
            actor: {
              tag: "user",
              user: {
                emailAddress: existingTrainerMetalMill.email,
                memberNumber: existingTrainerMetalMill.memberNumber,
              }
            },
          });
        });

        it('user appears as trained', async () => {
          const matrix = await getTrainingMatrix(user.memberNumber);
          expect(matrix[0].equipment_id).toStrictEqual(metalMill.id);
          expectMatchSecondsPrecision(trainedOnMetalMill.trainedAt)(getSomeOrFail(matrix[0].is_trained));
        });

        describe('user is marked as an owner for the metal shop', () => {
          const markedAsOwner: AddOwner = {
            areaId: metalshop.id,
            memberNumber: user.memberNumber
          };
          beforeEach(async () => {
            await framework.commands.area.addOwner(markedAsOwner);
          });

          it('user appears as an owner for all pieces of metal shop equipment', async () => {
            const matrix = await getTrainingMatrix(user.memberNumber);
            expect(matrix.every(r => O.isSome(r.is_owner))).toStrictEqual(true);
          });

          describe('user is marked as a trainer for the metal mill', () => {
            const markedAsTrainer: AddTrainer = {
              equipmentId: metalMill.id,
              memberNumber: user.memberNumber
            };
            beforeEach(async () => {
              await framework.commands.trainers.add(markedAsTrainer);
            });

            it('user appears as a trainer', async() => {
              const matrix = await getTrainingMatrix(user.memberNumber);
              const metalMillRow = matrix.find(r => r.equipment_id === metalMill.id)!;
              expect(O.isSome(metalMillRow.is_trainer)).toBeTruthy();
            });
          });
        });
      });
    });
  });
});
