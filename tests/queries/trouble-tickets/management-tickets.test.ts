import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {pipe} from 'fp-ts/lib/function';
import * as T from 'fp-ts/Task';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructViewModel} from '../../../src/queries/trouble-tickets/construct-view-model';
import {constructViewModel as constructHomeViewModel} from '../../../src/queries/trouble-tickets-home/construct-view-model';
import {ticketsVisibleTo} from '../../../src/queries/trouble-tickets/management-tickets';
import {Dependencies} from '../../../src/dependencies';
import {arbitraryUser} from '../../types/user.helper';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import {constructEvent} from '../../../src/types';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// A ticket raised from the mailbox carries what a member wrote to the
// management team. That is not every area owner's to read.
describe('tickets raised from management email', () => {
  let framework: TestFramework;
  let deps: Dependencies;
  const managementAreaId = faker.string.uuid() as UUID;
  const woodAreaId = faker.string.uuid() as UUID;
  const manager = arbitraryUser();
  const woodOwner = arbitraryUser();
  const superUser = arbitraryUser();

  // Only the mailbox raises a ticket against an area directly, and it builds
  // the event itself - so the test does too.
  const recordTicket = async (areaId: UUID, title: string) =>
    getRightOrFail(
      await framework.depsForCommands.commitEvent(
        framework.sharedReadModel.getCurrentEventIndex()
      )(
        constructEvent('TroubleTicketCreated')({
          id: faker.string.uuid() as UUID,
          rowHash: `email:${faker.string.uuid()}`,
          sheetId: 'email',
          submittedAt: new Date(),
          submittedMemberNumber: null,
          submittedEmail: null,
          submittedName: null,
          submittedEquipment: null,
          otherEquipmentDetail: '',
          status: '',
          attempting: '',
          issue: 'what they wrote',
          steps: '',
          source: 'email',
          equipmentId: null,
          machine: '',
          areaId,
          title,
          mailboxConversationId: faker.string.alphanumeric(16),
          actor: arbitraryActor(),
        })
      )()
    );

  const board = (
    user: typeof manager,
    options: {showAll?: boolean; areaId?: string} = {}
  ) =>
    pipe(
      user,
      constructViewModel(deps, {
        showAll: options.showAll ?? true,
        page: 1,
        status: O.none,
        only: O.none,
        areaId: options.areaId,
      }),
      T.map(getRightOrFail)
    )();

  const home = (user: typeof manager) =>
    pipe(user, constructHomeViewModel(deps, {}), T.map(getRightOrFail))();

  beforeEach(async () => {
    framework = await initTestFramework();
    deps = {
      ...framework.depsForCommands,
      conf: {
        ...framework.depsForCommands.conf,
        MANAGEMENT_TEAM_AREA_ID: managementAreaId,
      },
    };
    for (const member of [manager, woodOwner, superUser]) {
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
      id: managementAreaId,
      name: 'Management Team' as NonEmptyString,
    });
    await framework.commands.area.create({
      id: woodAreaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.area.addOwner({
      areaId: managementAreaId,
      memberNumber: manager.memberNumber,
    });
    await framework.commands.area.addOwner({
      areaId: woodAreaId,
      memberNumber: woodOwner.memberNumber,
    });
    await recordTicket(
      managementAreaId,
      'Something a member wrote to management'
    );
    await recordTicket(woodAreaId, 'The band saw is blunt');
  });

  afterEach(() => {
    framework.close();
  });

  const issues = (tickets: ReadonlyArray<{title: string}>) =>
    tickets.map(item => item.title);

  describe('on the board', () => {
    it('are hidden from an owner of another area, even showing everything', async () => {
      const view = await board(woodOwner, {showAll: true});

      expect(issues(view.tickets)).toStrictEqual(['The band saw is blunt']);
      expect(view.totalInScope).toBe(1);
    });

    // Pointing the board at the management area is the obvious way to try.
    it('stay hidden when that area is asked for by name', async () => {
      const view = await board(woodOwner, {areaId: 'management-team'});

      expect(view.tickets).toHaveLength(0);
    });

    it('are not counted in the status chips for other owners', async () => {
      const view = await board(woodOwner, {showAll: true});

      expect(view.statusCounts.Todo).toBe(1);
    });

    it('are visible to an owner of the management area', async () => {
      const view = await board(manager, {showAll: true});

      expect(issues(view.tickets)).toContain(
        'Something a member wrote to management'
      );
    });

    // Space admins and directors: the people who run the system anyway.
    it('are visible to a super-user', async () => {
      const view = await board(superUser, {showAll: true});

      expect(view.tickets).toHaveLength(2);
    });
  });

  // Both pages read tickets through one function, so a page added later -
  // a member-facing one especially - cannot quietly skip the rule.
  describe('the one way tickets are read', () => {
    it('gives an ordinary owner everything but the management tickets', () => {
      const visible = ticketsVisibleTo(
        framework.sharedReadModel,
        managementAreaId,
        {isSuperUser: false, ownerOf: [{id: woodAreaId, name: 'Wood Shop', ownershipRecordedAt: new Date()}]}
      );

      expect(visible).toHaveLength(1);
    });

    it('gives the management team all of them', () => {
      const visible = ticketsVisibleTo(
        framework.sharedReadModel,
        managementAreaId,
        {
          isSuperUser: false,
          ownerOf: [
            {
              id: managementAreaId,
              name: 'Management Team',
              ownershipRecordedAt: new Date(),
            },
          ],
        }
      );

      expect(visible).toHaveLength(2);
    });

    // With nothing configured there is no management area to hide, and the
    // rule must not start hiding tickets filed against no area at all.
    it('hides nothing when no management area is configured', () => {
      const visible = ticketsVisibleTo(framework.sharedReadModel, '', {
        isSuperUser: false,
        ownerOf: [],
      });

      expect(visible).toHaveLength(2);
    });
  });

  describe('in the counts on the trouble tickets page', () => {
    it('are left out for everybody else', async () => {
      expect((await home(woodOwner)).active).toBe(1);
    });

    it('are counted for the management team', async () => {
      expect((await home(manager)).active).toBe(2);
    });
  });
});
