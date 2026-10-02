import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import { constructTrainingMatrix } from '../../../src/queries/training-matrix/construct-view-model';
import { getSomeOrFail } from '../../helpers';
import { faker } from '@faker-js/faker';
import { EmailAddress } from '../../../src/types';
import { MemberNumber } from '../../../src/types/member-number';
import { CreateArea } from '../../../src/commands/area/create';
import { NonEmptyString, UUID } from 'io-ts-types';
import { AddEquipment } from '../../../src/commands/equipment/add';
import { EquipmentId } from '../../../src/types/equipment-id';
import { LinkNumberToEmail } from '../../../src/commands/member-numbers/link-number-to-email';
import { FullQuizResultsForMember } from '../../../src/read-models/external-state/equipment-quiz';
import { UserActor } from '../../../src/types/actor';
import { Int } from 'io-ts';

// The matrix previously built itself from the fully-expanded equipment view,
// whose cost grows with every trainer and every trained member of every
// machine - i.e. with the whole membership. These tests pin the property that
// constructing one member's matrix costs a bounded, membership-independent
// number of queries (issue #414).

// better-sqlite3's Database#prepare is the funnel every drizzle query passes
// through, so wrapping it counts statements issued while the action runs.
const countQueriesDuring = <A>(
  framework: TestFramework,
  action: () => A
): {result: A; queryCount: number} => {
  let queryCount = 0;
  const db = framework.sharedReadModel._underlyingReadModelDb;
  const originalPrepare = db.prepare.bind(db);
  db.prepare = ((...args: Parameters<typeof originalPrepare>) => {
    queryCount += 1;
    return originalPrepare(...args);
  }) as typeof db.prepare;
  try {
    const result = action();
    return {result, queryCount};
  } finally {
    db.prepare = originalPrepare;
  }
};

describe('construct-training-matrix query count', () => {
  let framework: TestFramework;

  const metalshop: CreateArea = {
    id: faker.string.uuid() as UUID,
    name: 'Metal Shop' as NonEmptyString,
  };
  const metalMill: AddEquipment = {
    id: faker.string.uuid() as EquipmentId,
    name: 'Metal Mill' as NonEmptyString,
    areaId: metalshop.id
  };

  const linkMember = async (): Promise<{
    memberNumber: MemberNumber;
    email: EmailAddress;
  }> => {
    const member: LinkNumberToEmail = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
      name: faker.animal.cat(),
      formOfAddress: faker.person.prefix(),
    };
    await framework.commands.memberNumbers.linkNumberToEmail(member);
    return {memberNumber: member.memberNumber, email: member.email};
  };

  // markMemberTrainedBy only produces an event for a 'user' actor whose
  // memberNumber matches trainedByMemberNumber, so the trainer acts on
  // themselves marking the target.
  const markTrained = (trainer: {memberNumber: MemberNumber; email: EmailAddress}) => (target: MemberNumber) =>
    framework.commands.trainers.markMemberTrainedBy({
      equipmentId: metalMill.id,
      memberNumber: target as Int,
      trainedByMemberNumber: trainer.memberNumber as Int,
      trainedAt: faker.date.recent(),
      actor: {
        tag: 'user',
        user: {
          emailAddress: trainer.email,
          memberNumber: trainer.memberNumber,
        },
      } satisfies UserActor,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create(metalshop);
    await framework.commands.equipment.add(metalMill);
  });
  afterEach(() => {
    framework.close();
  });

  it('query count does not grow with unrelated members trained on the same machine', async () => {
    const viewer = await linkMember();
    const trainer = await linkMember();
    // Trainers must be area owners, and registered as trainers on the machine.
    await framework.commands.area.addOwner({
      areaId: metalshop.id,
      memberNumber: trainer.memberNumber,
    });
    await framework.commands.trainers.add({
      equipmentId: metalMill.id,
      memberNumber: trainer.memberNumber,
    });
    const markByTrainer = markTrained(trainer);
    const populateUnrelated = async (n: number) => {
      for (let i = 0; i < n; i += 1) {
        const {memberNumber} = await linkMember();
        await markByTrainer(memberNumber);
      }
    };

    await markByTrainer(viewer.memberNumber);
    await populateUnrelated(10);

    const quizData: FullQuizResultsForMember = {equipmentQuiz: {}};
    const readMember = () =>
      getSomeOrFail(framework.sharedReadModel.members.getByMemberNumber(viewer.memberNumber));
    const {queryCount: smallQueryCount} = countQueriesDuring(framework, () =>
      constructTrainingMatrix(readMember(), framework.sharedReadModel, quizData)
    );

    await populateUnrelated(90);
    const {queryCount: largeQueryCount} = countQueriesDuring(framework, () =>
      constructTrainingMatrix(readMember(), framework.sharedReadModel, quizData)
    );

    expect(largeQueryCount).toStrictEqual(smallQueryCount);
    expect(smallQueryCount).toBeLessThan(20);
  });
});
