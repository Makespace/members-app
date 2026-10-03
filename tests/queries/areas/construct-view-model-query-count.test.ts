import {faker} from '@faker-js/faker';
import {advanceTo, clear} from 'jest-date-mock';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail, insertRecurlySubscription} from '../../helpers';
import {constructViewModel} from '../../../src/queries/areas/construct-view-model';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';

// The areas page previously expanded every area's every machine - trainers,
// trainees, member details and training attribution for the whole membership -
// and queried Recurly for every owner on every view. These tests pin the
// replacement's work bounds (issue #414, deliverables C+D): statement counts
// that do not grow with trainees, one Recurly lookup per distinct owner only
// for super-users, and no per-trainee member lookups.

// better-sqlite3's Database#prepare is the funnel every drizzle query passes
// through, so wrapping it counts shared-state statements issued while the
// action runs.
const countSharedStatements = <A>(
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

// The recurly cache runs through the libsql client's execute funnel.
const countExternalStatements = async <A>(
  framework: TestFramework,
  action: () => Promise<A>
): Promise<{result: A; queryCount: number}> => {
  let queryCount = 0;
  const client = framework.extDBClient;
  const originalExecute = client.execute.bind(client);
  client.execute = ((...args: Parameters<typeof originalExecute>) => {
    queryCount += 1;
    return originalExecute(...args);
  }) as typeof client.execute;
  try {
    const result = await action();
    return {result, queryCount};
  } finally {
    client.execute = originalExecute;
  }
};

describe('construct-view-model query counts', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    clear();
    framework.close();
  });

  const unprivilegedUser = arbitraryUser();
  const superUser = arbitraryUser();
  const owner = {
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
  };
  let equipmentId: UUID;

  beforeEach(async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: unprivilegedUser.memberNumber,
      email: unprivilegedUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: superUser.memberNumber,
      email: superUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });
    await framework.commands.memberNumbers.linkNumberToEmail(owner);
    const area = {
      id: faker.string.uuid() as UUID,
      name: 'Count Area' as NonEmptyString,
    };
    equipmentId = faker.string.uuid() as UUID;
    await framework.commands.area.create({
      ...area,
      actor: {tag: 'user', user: superUser},
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Count Machine' as NonEmptyString,
      areaId: area.id,
      actor: {tag: 'user', user: superUser},
    });
    await framework.commands.area.addOwner({
      areaId: area.id,
      memberNumber: owner.memberNumber,
    });
    await framework.commands.trainers.markMemberTrainedBy({
      equipmentId,
      memberNumber: owner.memberNumber as Int,
      trainedByMemberNumber: owner.memberNumber as Int,
      trainedAt: new Date('2026-05-03T12:00:00.000Z'),
      actor: {
        tag: 'user',
        user: {
          emailAddress: owner.email,
          memberNumber: owner.memberNumber,
        },
      },
    });
  });

  const markExtraTrainees = async (count: number) => {
    for (let i = 0; i < count; i += 1) {
      const trainee = {
        memberNumber: faker.number.int(),
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      };
      await framework.commands.memberNumbers.linkNumberToEmail(trainee);
      await framework.commands.trainers.markMemberTrainedBy({
        equipmentId,
        memberNumber: trainee.memberNumber as Int,
        trainedByMemberNumber: owner.memberNumber as Int,
        trainedAt: new Date('2026-05-04T12:00:00.000Z'),
        actor: {
          tag: 'user',
          user: {
            emailAddress: owner.email,
            memberNumber: owner.memberNumber,
          },
        },
      });
    }
  };

  const runAs = (user: typeof superUser) => async () =>
    getRightOrFail(
      await constructViewModel(framework.sharedReadModel, framework.extDB)(
        user
      )()
    );

  it('shared statement count does not grow with extra trainees', async () => {
    advanceTo(new Date('2026-07-22T12:00:00.000Z'));
    const asSuperUser = runAs(superUser);

    const small = countSharedStatements(framework, () => asSuperUser());
    await small.result;
    await markExtraTrainees(10);
    const large = countSharedStatements(framework, () => asSuperUser());
    const largeViewModel = await large.result;

    expect(
      largeViewModel.areas[0].equipment[0].trainingsByQuarter.map(
        quarter => quarter.count
      )
    ).toStrictEqual([0, 0, 11, 0]);
    expect(large.queryCount).toStrictEqual(small.queryCount);
  });

  it('makes zero Recurly cache queries for an ordinary member', async () => {
    advanceTo(new Date('2026-07-22T12:00:00.000Z'));
    await insertRecurlySubscription(framework.extDB, {
      email: owner.email,
      hasActiveSubscription: false,
      hasPastDueInvoice: true,
    });

    const outer = await countExternalStatements(framework, async () =>
      countSharedStatements(framework, () => runAs(unprivilegedUser)())
    );
    const viewModel = await outer.result.result;

    // The owner is past-due, yet an ordinary member's view neither groups
    // owners by subscription nor shows reason chips - so no cache query.
    expect(viewModel.areas[0].owners[0].reasons).toStrictEqual([]);
    expect(viewModel.areas[0].owners[0].isActiveOwner).toStrictEqual(true);
    expect(outer.queryCount).toStrictEqual(0);
  });

  it('queries Recurly once per distinct owner for a super-user, not per area', async () => {
    advanceTo(new Date('2026-07-22T12:00:00.000Z'));
    // Same owner owning both areas: a per-owner-assignment implementation
    // would look them up twice.
    const secondArea = {
      id: faker.string.uuid() as UUID,
      name: 'Second Area' as NonEmptyString,
    };
    await framework.commands.area.create({
      ...secondArea,
      actor: {tag: 'user', user: superUser},
    });
    await framework.commands.area.addOwner({
      areaId: secondArea.id,
      memberNumber: owner.memberNumber,
    });
    await insertRecurlySubscription(framework.extDB, {
      email: owner.email,
      hasActiveSubscription: false,
      hasPastDueInvoice: true,
    });

    const asSuperUser = runAs(superUser);
    const outer = await countExternalStatements(framework, async () =>
      countSharedStatements(framework, () => asSuperUser())
    );
    const viewModel = await outer.result.result;

    expect(viewModel.areas).toHaveLength(2);
    // Past-due means inactive on this page, and the reason chips explain why.
    expect(viewModel.areas[0].owners[0].isActiveOwner).toStrictEqual(false);
    expect(viewModel.areas[0].owners[0].reasons).toStrictEqual(['past-due']);
    expect(outer.queryCount).toStrictEqual(1);
  });
});
