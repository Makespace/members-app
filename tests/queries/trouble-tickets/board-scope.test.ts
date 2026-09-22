import {faker} from '@faker-js/faker';
import {pipe} from 'fp-ts/lib/function';
import * as T from 'fp-ts/Task';
import {NonEmptyString, UUID} from 'io-ts-types';
import {
  constructViewModel,
  PAGE_SIZE,
} from '../../../src/queries/trouble-tickets/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

const ticket = (submittedEquipment: string | null) => ({
  id: faker.string.uuid() as UUID,
  rowHash: faker.string.alphanumeric(64) as NonEmptyString,
  sheetId: faker.string.alphanumeric(10) as NonEmptyString,
  submittedAt: faker.date.past(),
  submittedMemberNumber: null,
  submittedEmail: null,
  submittedName: null,
  submittedEquipment,
  otherEquipmentDetail: '',
  status: 'Down',
  attempting: '',
  issue: faker.lorem.sentence(),
  steps: '',
});

describe('/trouble-tickets scope and pagination', () => {
  let framework: TestFramework;
  const woodAreaId = faker.string.uuid() as UUID;
  const laserAreaId = faker.string.uuid() as UUID;
  const owner = arbitraryUser();
  const superUser = arbitraryUser();

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const member of [owner, superUser]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: member.memberNumber,
        email: member.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });
    await framework.commands.area.create({
      id: woodAreaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.area.create({
      id: laserAreaId,
      name: 'Laser Cutters' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: faker.string.uuid() as UUID,
      name: 'Band Saw' as NonEmptyString,
      areaId: woodAreaId,
    });
    await framework.commands.equipment.add({
      id: faker.string.uuid() as UUID,
      name: 'Trotec' as NonEmptyString,
      areaId: laserAreaId,
    });
    await framework.commands.area.addOwner({
      areaId: woodAreaId,
      memberNumber: owner.memberNumber,
    });
    await framework.commands.troubleTickets.record(ticket('Band Saw'));
    await framework.commands.troubleTickets.record(ticket('Trotec'));
    await framework.commands.troubleTickets.record(ticket('Mystery machine'));
  });

  afterEach(() => {
    framework.close();
  });

  const view = (user: typeof owner, showAll: boolean, page = 1) =>
    pipe(
      user,
      constructViewModel(framework.depsForCommands, {showAll, page}),
      T.map(getRightOrFail)
    )();

  it('defaults an owner to just their areas', async () => {
    const vm = await view(owner, false);
    expect(vm.scopedToMine).toBe(true);
    expect(vm.totalInScope).toBe(1);
    expect(vm.tickets[0].areaName).toMatchObject({value: 'Wood Shop'});
  });

  it('show=all reveals everything to an owner', async () => {
    const vm = await view(owner, true);
    expect(vm.scopedToMine).toBe(false);
    expect(vm.totalInScope).toBe(3);
  });

  it('a super-user with no areas sees everything by default', async () => {
    const vm = await view(superUser, false);
    expect(vm.scopedToMine).toBe(false);
    expect(vm.totalInScope).toBe(3);
  });

  it('paginates beyond PAGE_SIZE and clamps out-of-range pages', async () => {
    for (let i = 0; i < PAGE_SIZE; i++) {
      await framework.commands.troubleTickets.record(ticket('Trotec'));
    }
    const first = await view(superUser, true, 1);
    expect(first.tickets).toHaveLength(PAGE_SIZE);
    expect(first.pageCount).toBe(2);
    const second = await view(superUser, true, 2);
    expect(second.tickets).toHaveLength(3);
    const clamped = await view(superUser, true, 99);
    expect(clamped.page).toBe(2);
  });

  it('serves change logs from the read model projection', async () => {
    const [woodTicket] = (await view(owner, false)).tickets;
    await framework.commands.troubleTickets.assign({
      ticketId: woodTicket.id,
      comment: '',
      actor: {
        tag: 'user',
        user: {
          emailAddress: owner.emailAddress,
          memberNumber: owner.memberNumber,
        },
      },
    });

    const vm = await view(owner, false);
    const refreshed = vm.tickets.find(t => t.id === woodTicket.id);
    expect(refreshed?.changeLog).toHaveLength(1);
    expect(refreshed?.changeLog[0].summary).toContain(
      'assigned themselves and set the ticket to In Progress'
    );
  });
});
