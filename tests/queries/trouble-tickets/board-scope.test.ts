import * as O from 'fp-ts/Option';
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

  const viewFiltered = (
    user: typeof owner,
    filters: {
      status?: 'Todo' | 'Resolved';
      only?: 'mine' | 'my-area' | 'my-machines';
      page?: number;
    }
  ) =>
    pipe(
      user,
      constructViewModel(framework.depsForCommands, {
        showAll: true,
        page: filters.page ?? 1,
        status: O.fromNullable(filters.status),
        only: O.fromNullable(filters.only),
      }),
      T.map(getRightOrFail)
    )();

  const view = (user: typeof owner, showAll: boolean, page = 1) =>
    pipe(
      user,
      constructViewModel(framework.depsForCommands, {
        showAll,
        page,
        status: O.none,
        only: O.none,
      }),
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

  // The counts describe everything in scope, not the page in front of you:
  // a chip saying "Resolved 0" while a later page is full of resolved
  // tickets is worse than no count at all.
  describe('filter counts and filtering', () => {
    it('counts every ticket in scope, not just the current page', async () => {
      const board = await viewFiltered(superUser, {});

      expect(board.statusCounts.Todo).toBe(3);
      expect(board.statusCounts.Resolved).toBe(0);
    });

    it('filters before paging, so a filtered view starts at its own page one', async () => {
      const board = await viewFiltered(superUser, {status: 'Todo'});

      expect(board.tickets).toHaveLength(3);
      expect(board.totalInScope).toBe(3);
      expect(board.page).toBe(1);
    });

    it('reports an empty result for a status nothing matches, while still counting the rest', async () => {
      const board = await viewFiltered(superUser, {status: 'Resolved'});

      expect(board.tickets).toHaveLength(0);
      // The chips still say what else is there, so the way back is visible.
      expect(board.statusCounts.Todo).toBe(3);
    });

    it('narrows to the viewer relationship asked for', async () => {
      const board = await viewFiltered(owner, {only: 'my-area'});

      expect(
        board.tickets.every(ticket => ticket.inMyOwnerArea)
      ).toBe(true);
      expect(board.scopeCounts['my-area']).toBe(board.tickets.length);
    });

    it('remembers which filter is active, so the chip can show it', async () => {
      const board = await viewFiltered(superUser, {status: 'Todo'});

      expect(board.activeStatus).toStrictEqual(O.some('Todo'));
      expect(board.activeScope).toStrictEqual(O.none);
    });
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
