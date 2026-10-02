import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import { constructTrainingMatrix } from '../../../src/queries/training-matrix/construct-view-model';
import { getSomeOrFail } from '../../helpers';
import { faker } from '@faker-js/faker';
import { EmailAddress } from '../../../src/types';
import { MemberNumber } from '../../../src/types/member-number';
import { UUID } from 'io-ts-types';
import { EquipmentId } from '../../../src/types/equipment-id';
import { FullQuizResultsForMember } from '../../../src/read-models/external-state/equipment-quiz';
import { constructEvent } from '../../../src/types';
import { arbitraryActor } from '../../helpers';
import * as O from 'fp-ts/Option';

// End-to-end shape check on a sizable fixture: one member's matrix must stay
// correct (right areas, right machines, right flags) no matter how much
// unrelated training data exists. Under the old full-expansion path this
// fixture meant expanding every machine's whole trained-member list; the
// matrix itself only ever consumed equipment id/name and area names (#414).

const AREA_COUNT = 30;
const MACHINES_PER_AREA = 10;
const UNRELATED_MEMBERS = 3000;

describe('construct-training-matrix scale', () => {
  let framework: TestFramework;

  const linkMemberEvent = (memberNumber: MemberNumber, email: EmailAddress) =>
    framework.insertIntoSharedReadModel(
      constructEvent('MemberNumberLinkedToEmail')({
        memberNumber,
        email,
        name: faker.animal.cat(),
        formOfAddress: faker.person.prefix(),
        actor: arbitraryActor(),
      })
    );

  beforeEach(async () => {
    framework = await initTestFramework();

    const areas: UUID[] = [];
    for (let a = 0; a < AREA_COUNT; a += 1) {
      const areaId = faker.string.uuid() as UUID;
      areas.push(areaId);
      framework.insertIntoSharedReadModel(
        constructEvent('AreaCreated')({
          id: areaId,
          name: `Area ${a}`,
          actor: arbitraryActor(),
        })
      );
      for (let m = 0; m < MACHINES_PER_AREA; m += 1) {
        framework.insertIntoSharedReadModel(
          constructEvent('EquipmentAdded')({
            id: faker.string.uuid() as EquipmentId,
            name: `Machine ${a}-${m}`,
            areaId,
            category: 'red',
            actor: arbitraryActor(),
          })
        );
      }
    }

    // Unrelated members, each trained on one machine. This is the growth the
    // old implementation paid for on every member page.
    const machineIds = framework.sharedReadModel
      .equipment.getAllMinimal()
      .map(e => e.id);
    for (let i = 0; i < UNRELATED_MEMBERS; i += 1) {
      const memberNumber = 10000 + i;
      linkMemberEvent(
        memberNumber,
        `member${i}@example.com` as EmailAddress
      );
      framework.insertIntoSharedReadModel(
        constructEvent('MemberTrainedOnEquipmentBy')({
          equipmentId: machineIds[i % machineIds.length],
          memberNumber,
          trainedByMemberNumber: memberNumber,
          trainedAt: faker.date.recent(),
          markedTrainedBy: memberNumber,
          actor: arbitraryActor(),
        })
      );
    }
  }, 300_000);

  afterEach(() => {
    framework.close();
  });

  it('shows only the viewer’s own training and ownership', async () => {
    // The viewer: trained on one machine in the first area, and owner of a
    // second, empty area (exercises the owner-only branch).
    const viewerNumber = 99999;
    framework.insertIntoSharedReadModel(
      constructEvent('MemberNumberLinkedToEmail')({
        memberNumber: viewerNumber,
        email: 'viewer@example.com' as EmailAddress,
        name: 'Viewer',
        formOfAddress: 'View',
        actor: arbitraryActor(),
      })
    );
    const firstMachine = framework.sharedReadModel
      .equipment.getAllMinimal()
      .find(e => e.name === 'Machine 0-0')!;
    framework.insertIntoSharedReadModel(
      constructEvent('MemberTrainedOnEquipmentBy')({
        equipmentId: firstMachine.id,
        memberNumber: viewerNumber,
        trainedByMemberNumber: viewerNumber,
        trainedAt: faker.date.recent(),
        markedTrainedBy: viewerNumber,
        actor: arbitraryActor(),
      })
    );
    const ownedAreaId = faker.string.uuid() as UUID;
    framework.insertIntoSharedReadModel(
      constructEvent('AreaCreated')({
        id: ownedAreaId,
        name: 'Viewer Area',
        actor: arbitraryActor(),
      })
    );
    framework.insertIntoSharedReadModel(
      constructEvent('OwnerAdded')({
        areaId: ownedAreaId,
        memberNumber: viewerNumber,
        actor: arbitraryActor(),
      })
    );

    const member = getSomeOrFail(
      framework.sharedReadModel.members.getByMemberNumber(viewerNumber)
    );
    const quizData: FullQuizResultsForMember = {equipmentQuiz: {}};
    const started = process.hrtime.bigint();
    const matrix = constructTrainingMatrix(member, framework.sharedReadModel, quizData);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;

    expect(matrix).toHaveLength(2);

    const trainedArea = matrix.find(area => area.area.name === 'Area 0')!;
    expect(trainedArea.equipment).toHaveLength(1);
    expect(trainedArea.equipment[0].equipment_id).toStrictEqual(firstMachine.id);
    expect(trainedArea.equipment[0].equipment_name).toStrictEqual(firstMachine.name);
    expect(O.isSome(trainedArea.equipment[0].is_trained)).toStrictEqual(true);
    expect(O.isNone(trainedArea.equipment[0].is_trainer)).toStrictEqual(true);
    expect(O.isNone(trainedArea.area.is_owner)).toStrictEqual(true);

    const ownedArea = matrix.find(area => area.area.name === 'Viewer Area')!;
    expect(ownedArea.area.id).toStrictEqual(ownedAreaId);
    expect(O.isSome(ownedArea.area.is_owner)).toStrictEqual(true);
    expect(ownedArea.equipment).toHaveLength(0);

    expect(elapsedMs).toBeLessThan(500);
  });
});
