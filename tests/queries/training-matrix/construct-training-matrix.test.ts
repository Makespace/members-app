import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import { getFullQuizResultsForMember } from '../../../src/read-models/external-state/equipment-quiz';
import { getRightOrFail, getSomeOrFail } from '../../helpers';
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
    });
  });
});
