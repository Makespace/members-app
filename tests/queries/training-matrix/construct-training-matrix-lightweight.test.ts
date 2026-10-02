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
import { constructEvent } from '../../../src/types';
import { arbitraryActor } from '../../helpers';

const _getTrainingMatrix = (framework: TestFramework) => async (memberNumber: MemberNumber) => {
  return constructTrainingMatrix(
    getSomeOrFail(framework.sharedReadModel.members.getByMemberNumber(memberNumber)),
    framework.sharedReadModel,
    getRightOrFail(
      await getFullQuizResultsForMember(framework, memberNumber)()
    )
  );
};

describe('construct-training-matrix (lightweight lookups)', () => {
  let framework: TestFramework;
  let getTrainingMatrix: ReturnType<typeof _getTrainingMatrix>;

  const metalshop: CreateArea = {
    id: faker.string.uuid() as UUID,
    name: 'Metal Shop' as NonEmptyString,
  };
  const metalMill: AddEquipment = {
    id: faker.string.uuid() as EquipmentId,
    name: 'Metal Mill' as NonEmptyString,
    areaId: metalshop.id
  };
  const woodshop: CreateArea = {
    id: faker.string.uuid() as UUID,
    name: 'Wood Shop' as NonEmptyString,
  };
  const bandSaw: AddEquipment = {
    id: faker.string.uuid() as EquipmentId,
    name: 'Band Saw' as NonEmptyString,
    areaId: woodshop.id
  };

  beforeEach(async () => {
    framework = await initTestFramework();
    getTrainingMatrix = _getTrainingMatrix(framework);

    await framework.commands.area.create(metalshop);
    await framework.commands.equipment.add(metalMill);
    await framework.commands.area.create(woodshop);
    await framework.commands.equipment.add(bandSaw);
  });
  afterEach(() => {
    framework.close();
  });

  describe('equipment in an area that is later removed', () => {
    // Removing an area cascades away its equipment rows (FK ON DELETE CASCADE
    // is enforced), so the machine disappears from the matrix even though the
    // member's trainedMembers row survives. This pins that behavior: the
    // matrix must not fabricate a row for the vanished machine.
    const doomedAreaId = faker.string.uuid() as UUID;
    const doomedMachine: AddEquipment = {
      id: faker.string.uuid() as EquipmentId,
      name: 'Doomed Machine' as NonEmptyString,
      areaId: doomedAreaId
    };
    const viewer: LinkNumberToEmail = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
      name: faker.animal.cat(),
      formOfAddress: faker.person.prefix(),
    };

    let matrix: TrainingMatrix;

    beforeEach(async () => {
      framework.insertIntoSharedReadModel(
        constructEvent('AreaCreated')({
          id: doomedAreaId,
          name: 'Doomed Area',
          actor: arbitraryActor(),
        })
      );
      framework.insertIntoSharedReadModel(
        constructEvent('EquipmentAdded')({
          id: doomedMachine.id,
          name: doomedMachine.name,
          areaId: doomedAreaId,
          category: 'red',
          actor: arbitraryActor(),
        })
      );
      framework.insertIntoSharedReadModel(
        constructEvent('MemberNumberLinkedToEmail')({
          memberNumber: viewer.memberNumber,
          email: viewer.email,
          name: viewer.name,
          formOfAddress: viewer.formOfAddress,
          actor: arbitraryActor(),
        })
      );
      framework.insertIntoSharedReadModel(
        constructEvent('MemberTrainedOnEquipmentBy')({
          equipmentId: doomedMachine.id,
          memberNumber: viewer.memberNumber,
          trainedByMemberNumber: viewer.memberNumber,
          trainedAt: new Date(),
          markedTrainedBy: viewer.memberNumber,
          actor: arbitraryActor(),
        })
      );
      framework.insertIntoSharedReadModel(
        constructEvent('AreaRemoved')({
          id: doomedAreaId,
          actor: arbitraryActor(),
        })
      );

      matrix = await getTrainingMatrix(viewer.memberNumber);
    });

    it('shows nothing for the cascaded machine', () => {
      expect(matrix).toHaveLength(0);
    });
  });
});
