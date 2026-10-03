import {faker} from '@faker-js/faker';
import {advanceTo, clear} from 'jest-date-mock';
import {Settings} from 'luxon';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail, arbitraryActor, insertRecurlySubscription} from '../../helpers';
import {constructViewModel} from '../../../src/queries/areas/construct-view-model';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {EmailAddress} from '../../../src/types';
import {EventOfType} from '../../../src/types/domain-event';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {trainedMemberstable} from '../../../src/read-models/shared-state/state';

// Behaviour-preservation tests for the /areas rework (issue #414, deliverables
// C+D). The narrow queries must produce the same counts and visibility the
// full expansion produced, including its deliberate asymmetries: legacy rows
// count towards equipment charts but not owner-delivery stats, orphan rows
// (trainee never linked) are dropped from equipment charts but a non-legacy
// orphan still counts in owner-delivery stats, retired machines stay in
// owner statistics scope, past member numbers still count, and quarter
// boundaries follow the calendar quarters.

describe('construct-view-model semantics', () => {
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
  let areaId: UUID;
  let redMachineId: UUID;
  let greenMachineId: UUID;
  // Drawn from a high range so the reserved past number below (current - 1)
  // can never collide with any other randomly drawn member number in these
  // tests, and so a lower number always exists for the rejoin fixture.
  const owner = {
    memberNumber: faker.number.int({min: 1_000_000_000, max: 2_000_000_000}) as Int,
    email: faker.internet.email() as EmailAddress,
  };
  // A second number the owner held before rejoining. Guaranteed lower than
  // the owner's current number - the rejoin projection rejects old > new -
  // and guaranteed distinct: every other number in this suite is drawn from
  // faker's full positive range, which only overlaps this range on one value
  // in ~4 billion, and the link command fails loudly on a clash.
  const ownerPastNumber = (owner.memberNumber - 1) as Int;

  beforeEach(async () => {
    areaId = faker.string.uuid() as UUID;
    redMachineId = faker.string.uuid() as UUID;
    greenMachineId = faker.string.uuid() as UUID;
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
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: owner.memberNumber,
      email: owner.email,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create({
      id: areaId,
      name: 'Semantics Area' as NonEmptyString,
      actor: {tag: 'user', user: superUser},
    });
    await framework.commands.equipment.add({
      id: redMachineId,
      name: 'Red Machine' as NonEmptyString,
      areaId,
      category: 'red',
      actor: {tag: 'user', user: superUser},
    });
    await framework.commands.equipment.add({
      id: greenMachineId,
      name: 'Green Machine' as NonEmptyString,
      areaId,
      category: 'green',
      actor: {tag: 'user', user: superUser},
    });
    await framework.commands.area.addOwner({
      areaId,
      memberNumber: owner.memberNumber,
    });
  });
  const linkMember = async () => {
    const member = {
      memberNumber: faker.number.int() as Int,
      email: faker.internet.email() as EmailAddress,
    };
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: member.memberNumber,
      email: member.email,
      name: undefined,
      formOfAddress: undefined,
    });
    return member;
  };

  const runAs = (user: typeof unprivilegedUser) => async () =>
    getRightOrFail(
      await constructViewModel(framework.sharedReadModel, framework.extDB)(
        user
      )()
    );

  const viewModelArea = (
    viewModel: Awaited<ReturnType<ReturnType<typeof runAs>>>,
    id: UUID
  ) => {
    const area = viewModel.areas.find(a => a.id === id);
    if (area === undefined) {
      throw new Error('seeded area missing from view model');
    }
    return area;
  };

  const machineNamed = (
    area_: ReturnType<typeof viewModelArea>,
    name: string
  ) => {
    const machine = area_.equipment.find(e => e.name === name);
    if (machine === undefined) {
      throw new Error('machine missing from view model');
    }
    return machine;
  };

  const markTrainedByOwner = (trainee: number, trainedAt: Date) =>
    framework.commands.trainers.markMemberTrainedBy({
      equipmentId: redMachineId,
      memberNumber: trainee as Int,
      trainedByMemberNumber: owner.memberNumber,
      trainedAt,
      actor: {
        tag: 'user',
        user: {emailAddress: owner.email, memberNumber: owner.memberNumber},
      },
    });

  // Legacy imports never went through the commands; they insert raw events.
  const insertLegacyTraining = (traineeNumber: number, trainedAt: Date) => {
    const event: EventOfType<'MemberTrainedOnEquipment'> = {
      type: 'MemberTrainedOnEquipment',
      equipmentId: redMachineId,
      memberNumber: traineeNumber,
      trainedByMemberNumber: owner.memberNumber,
      legacyImport: true,
      actor: {tag: 'system'},
      recordedAt: trainedAt,
    };
    framework.insertIntoSharedReadModel(event);
  };

  // Orphan training rows (the projector rejects training events for unknown
  // member numbers, so commands and raw events cannot create them): insert
  // the documented legacy-import state directly - userId NULL, trainee
  // memberNumber set, equipment resolvable.
  const insertOrphanTraining = (
    traineeNumber: number,
    trainedAt: Date,
    legacyImport: boolean
  ) =>
    framework.sharedReadModel.db
      .insert(trainedMemberstable)
      .values({
        userId: null,
        memberNumber: traineeNumber as Int,
        equipmentId: redMachineId,
        trainedAt,
        trainedByMemberNumber: owner.memberNumber,
        legacyImport,
        markTrainedByActor: arbitraryActor(),
      })
      .run();

  describe('equipment training counts', () => {
    it('count legacy-import rows when the trainee is resolvable', async () => {
      advanceTo(new Date('2026-07-22T12:00:00.000Z'));
      const trainee = await linkMember();
      insertLegacyTraining(
        trainee.memberNumber,
        new Date('2026-05-01T12:00:00.000Z')
      );

      const viewModel = await runAs(superUser)();
      const machine = machineNamed(
        viewModelArea(viewModel, areaId),
        'Red Machine'
      );
      expect(machine.trainingsByQuarter.map(q => q.count)).toStrictEqual([
        0, 0, 1, 0,
      ]);
    });

    it('drop orphan rows from equipment charts but keep non-legacy orphans in owner stats', async () => {
      advanceTo(new Date('2026-07-22T12:00:00.000Z'));
      // The projector rejects training events for unknown member numbers, so
      // these rows are seeded the way the legacy import left them: userId
      // NULL, trainee number unlinked. The old expansion dropped such rows
      // from equipment charts (the trainee member lookup failed), while the
      // owner-delivery query only filtered trainer, equipment and
      // legacyImport - so a non-legacy orphan attributed to the owner still
      // counted there. Preserve both behaviours.
      insertOrphanTraining(
        faker.number.int(),
        new Date('2026-05-01T12:00:00.000Z'),
        true
      );
      insertOrphanTraining(
        faker.number.int(),
        new Date('2026-06-01T12:00:00.000Z'),
        false
      );
      const orphanRowCount = framework.sharedReadModel.db
        .select()
        .from(trainedMemberstable)
        .all().length;
      expect(orphanRowCount).toStrictEqual(2);

      const viewModel = await runAs(superUser)();
      const area_ = viewModelArea(viewModel, areaId);
      // Equipment charts require a resolvable trainee: both orphans dropped.
      expect(
        machineNamed(area_, 'Red Machine').trainingsByQuarter.map(
          q => q.count
        )
      ).toStrictEqual([0, 0, 0, 0]);
      // Owner stats attributed this delivery to the owner regardless of
      // trainee resolvability; the legacy row stays excluded there.
      expect(
        area_.owners[0].trainingsByQuarter.map(q => q.count)
      ).toStrictEqual([0, 0, 1, 0]);
    });
  });

  describe('owner-delivery statistics', () => {
    it('count trainings delivered under past member numbers', async () => {
      advanceTo(new Date('2026-07-22T12:00:00.000Z'));
      // The owner held another number first (the past one), trained somebody
      // with it, then rejoined under the current number. The past number
      // lives on its own member record with its own email - linking an
      // already-used email throws - and the rejoin event merges the two
      // records. ownerPastNumber is the owner's number minus one, so the
      // rejoin's old < new invariant always holds.
      const pastMember = {
        memberNumber: ownerPastNumber,
        email: faker.internet.email() as EmailAddress,
      };
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: pastMember.memberNumber,
        email: pastMember.email,
        name: undefined,
        formOfAddress: undefined,
      });
      const trainee = await linkMember();
      await framework.commands.trainers.markMemberTrainedBy({
        equipmentId: redMachineId,
        memberNumber: trainee.memberNumber,
        trainedByMemberNumber: pastMember.memberNumber,
        trainedAt: new Date('2026-05-01T12:00:00.000Z'),
        actor: {
          tag: 'user',
          user: {emailAddress: owner.email, memberNumber: owner.memberNumber},
        },
      });
      await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
        oldMemberNumber: pastMember.memberNumber,
        newMemberNumber: owner.memberNumber,
      });

      const viewModel = await runAs(superUser)();
      const area_ = viewModelArea(viewModel, areaId);
      expect(area_.owners).toHaveLength(1);
      expect(
        area_.owners[0].trainingsByQuarter.map(q => q.count)
      ).toStrictEqual([0, 0, 1, 0]);
    });

    it('exclude legacy-import rows', async () => {
      advanceTo(new Date('2026-07-22T12:00:00.000Z'));
      // The same delivery as above, but legacy-imported: equipment charts
      // count it, owner-delivery statistics do not.
      const trainee = await linkMember();
      insertLegacyTraining(
        trainee.memberNumber,
        new Date('2026-05-01T12:00:00.000Z')
      );

      const viewModel = await runAs(superUser)();
      const area_ = viewModelArea(viewModel, areaId);
      expect(
        machineNamed(area_, 'Red Machine').trainingsByQuarter.map(
          q => q.count
        )
      ).toStrictEqual([0, 0, 1, 0]);
      expect(
        area_.owners[0].trainingsByQuarter.map(q => q.count)
      ).toStrictEqual([0, 0, 0, 0]);
    });

    it('show nothing for the owner chart when the only red machine is retired', async () => {
      advanceTo(new Date('2026-07-22T12:00:00.000Z'));
      const trainee = await linkMember();
      await markTrainedByOwner(
        trainee.memberNumber,
        new Date('2026-05-01T12:00:00.000Z')
      );
      await framework.commands.equipment.markObsolete({
        id: redMachineId,
        actor: {tag: 'user', user: superUser},
      });

      const viewModel = await runAs(superUser)();
      const area_ = viewModelArea(viewModel, areaId);
      // The retired machine disappears from the visible list...
      expect(area_.equipment).toHaveLength(1);
      expect(area_.equipment[0].name).toStrictEqual('Green Machine');
      // ...and with no visible red machine the trainings column disappears,
      // so the owner chart is not computed at all.
      expect(area_.owners[0].trainingsByQuarter).toStrictEqual([]);
    });

    it('keep counting retired-machine trainings while another red machine is visible', async () => {
      advanceTo(new Date('2026-07-22T12:00:00.000Z'));
      const secondRedId = faker.string.uuid() as UUID;
      await framework.commands.equipment.add({
        id: secondRedId,
        name: 'Second Red Machine' as NonEmptyString,
        areaId,
        category: 'red',
        actor: {tag: 'user', user: superUser},
      });
      // One delivery on the machine that is about to retire, one on the
      // machine that stays visible.
      const trainee = await linkMember();
      await markTrainedByOwner(
        trainee.memberNumber,
        new Date('2026-05-01T12:00:00.000Z')
      );
      const secondTrainee = await linkMember();
      await framework.commands.trainers.markMemberTrainedBy({
        equipmentId: secondRedId,
        memberNumber: secondTrainee.memberNumber,
        trainedByMemberNumber: owner.memberNumber,
        trainedAt: new Date('2026-06-01T12:00:00.000Z'),
        actor: {
          tag: 'user',
          user: {emailAddress: owner.email, memberNumber: owner.memberNumber},
        },
      });
      await framework.commands.equipment.markObsolete({
        id: redMachineId,
        actor: {tag: 'user', user: superUser},
      });

      const viewModel = await runAs(superUser)();
      const area_ = viewModelArea(viewModel, areaId);
      // Only the visible machine is listed...
      expect(area_.equipment.map(e => e.name)).toStrictEqual([
        'Green Machine',
        'Second Red Machine',
      ]);
      // ...but the owner's chart still counts the retired machine's delivery,
      // because the delivery statistics span all the area's equipment.
      expect(
        area_.owners[0].trainingsByQuarter.map(q => q.count)
      ).toStrictEqual([0, 0, 2, 0]);
    });

    it('stay scoped per area for an owner of several areas', async () => {
      advanceTo(new Date('2026-07-22T12:00:00.000Z'));
      const secondAreaId = faker.string.uuid() as UUID;
      await framework.commands.area.create({
        id: secondAreaId,
        name: 'Second Semantics Area' as NonEmptyString,
        actor: {tag: 'user', user: superUser},
      });
      const secondMachineId = faker.string.uuid() as UUID;
      await framework.commands.equipment.add({
        id: secondMachineId,
        name: 'Second Red Machine' as NonEmptyString,
        areaId: secondAreaId,
        category: 'red',
        actor: {tag: 'user', user: superUser},
      });
      await framework.commands.area.addOwner({
        areaId: secondAreaId,
        memberNumber: owner.memberNumber,
      });
      // One delivery in the first area only.
      const trainee = await linkMember();
      await markTrainedByOwner(
        trainee.memberNumber,
        new Date('2026-05-01T12:00:00.000Z')
      );

      const viewModel = await runAs(superUser)();
      const first = viewModelArea(viewModel, areaId);
      const second = viewModelArea(viewModel, secondAreaId);
      expect(first.owners[0].trainingsByQuarter.map(q => q.count)).toStrictEqual([0, 0, 1, 0]);
      expect(second.owners[0].trainingsByQuarter.map(q => q.count)).toStrictEqual([0, 0, 0, 0]);
    });
  });

  describe('viewer-scoped owner information', () => {
    it('shows every owner publicly to ordinary members, past-due or not', async () => {
      advanceTo(new Date('2026-07-22T12:00:00.000Z'));
      const viewModel = await runAs(unprivilegedUser)();
      const area_ = viewModelArea(viewModel, areaId);
      expect(area_.owners).toHaveLength(1);
      expect(area_.owners[0].memberNumber).toStrictEqual(owner.memberNumber);
      expect(area_.owners[0].isActiveOwner).toStrictEqual(true);
      expect(area_.owners[0].reasons).toStrictEqual([]);
    });

    it('treats an owner with an active subscription and a past-due invoice as inactive', async () => {
      advanceTo(new Date('2026-07-22T12:00:00.000Z'));
      // This is the rule local to the areas page: a past-due invoice makes an
      // otherwise-active owner inactive. hasActiveSubscription alone would
      // not catch a regression that drops the past-due half of the rule.
      await insertRecurlySubscription(framework.extDB, {
        email: owner.email,
        hasActiveSubscription: true,
        hasPastDueInvoice: true,
      });

      const viewModel = await runAs(superUser)();
      const area_ = viewModelArea(viewModel, areaId);
      expect(area_.owners[0].isActiveOwner).toStrictEqual(false);
      expect(area_.owners[0].reasons).toStrictEqual(['past-due']);
    });

    it('bucket equipment charts across quarter boundaries', async () => {
      // Pin the zone: the fixture puts the boundary deliveries at UTC
      // midnight, which is only a quarter boundary when the chart's zone is
      // UTC too. PreviousDefaultZoneStore restores whatever zone the host
      // had, so the test passes anywhere.
      const previousZone = Settings.defaultZone;
      Settings.defaultZone = 'UTC';
      try {
        advanceTo(new Date('2026-07-22T12:00:00.000Z'));
        const trainee = await linkMember();
        // Q1 2026 started 2026-04-01T00:00:00 UTC; a delivery exactly at
        // the boundary lands in the newer quarter, one millisecond earlier does
        // not.
        await markTrainedByOwner(trainee.memberNumber, new Date('2026-04-01T00:00:00.000Z'));
        const secondTrainee = await linkMember();
        await markTrainedByOwner(secondTrainee.memberNumber, new Date('2026-03-31T23:59:59.999Z'));

        const viewModel = await runAs(superUser)();
        const machine = machineNamed(viewModelArea(viewModel, areaId), 'Red Machine');
        // One millisecond before the boundary stays in Q1 2026, the delivery
        // exactly at the boundary lands in Q2 2026 - oldest first.
        expect(machine.trainingsByQuarter.map(q => q.count)).toStrictEqual([0, 1, 1, 0]);
      } finally {
        Settings.defaultZone = previousZone;
      }
    });
  });
});
