import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {
  TestFramework,
  initTestFramework,
} from '../read-models/test-framework';
import {getRightOrFail} from '../helpers';
import {Actor, EmailAddress} from '../../src/types';
import {Dependencies} from '../../src/dependencies';
import {TicketPermission} from '../../src/types/trouble-ticket-permission';
import {ticketVisibility} from '../../src/trouble-tickets/permission';
import {setPermission} from '../../src/commands/trouble-tickets/set-permission';
import {permissionForm} from '../../src/commands/trouble-tickets/permission-form';
import {applyCommand} from '../../src/commands/apply-command';
import {constructViewModel as board} from '../../src/queries/trouble-tickets/construct-view-model';
import {constructViewModel as detail} from '../../src/queries/trouble-ticket/construct-view-model';
import {render as renderTicket} from '../../src/queries/trouble-ticket/render';
import {constructViewModel as home} from '../../src/queries/trouble-tickets-home/construct-view-model';
import {
  isTicketOwner,
  canSetTicketEquipment,
} from '../../src/commands/trouble-tickets/authorization';
import {audienceFor} from '../../src/trouble-tickets/notification-audience';
import {claimUrl} from '../../src/trouble-tickets/claim-token';
import {claim} from '../../src/commands/trouble-tickets/claim';
import {claimForm} from '../../src/commands/trouble-tickets/claim-form';
import {Request, Response} from 'express';
import {CompleteHtmlDocument} from '../../src/types/html';
import {setPermissionPost} from '../../src/trouble-tickets/set-permission-post';

const REPORTER = 101;
const OWNER = 102;
const OTHER_OWNER = 103;
const MANAGER = 104;
const READER = 105;
const SUPER = 106;
const admin: Actor = {tag: 'token', token: 'admin'};
const user = (memberNumber: number) => ({
  memberNumber,
  emailAddress: `member${memberNumber}@example.com` as EmailAddress,
});
const actor = (memberNumber: number): Actor => ({
  tag: 'user',
  user: user(memberNumber),
});

describe('ticket visibility group', () => {
  let framework: TestFramework;
  let deps: Dependencies;
  let id: UUID;
  let equipmentId: UUID;
  let otherEquipmentId: UUID;
  let areaId: UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    id = faker.string.uuid() as UUID;
    equipmentId = faker.string.uuid() as UUID;
    otherEquipmentId = faker.string.uuid() as UUID;
    areaId = faker.string.uuid() as UUID;
    const managementId = faker.string.uuid() as UUID;
    const otherAreaId = faker.string.uuid() as UUID;
    deps = {
      ...framework.depsForCommands,
      conf: {
        ...framework.depsForCommands.conf,
        MANAGEMENT_TEAM_AREA_ID: managementId,
      },
    };
    for (const memberNumber of [
      REPORTER,
      OWNER,
      OTHER_OWNER,
      MANAGER,
      READER,
      SUPER,
    ]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: user(memberNumber).emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.superUser.declare({memberNumber: SUPER});
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood' as NonEmptyString,
    });
    await framework.commands.area.create({
      id: otherAreaId,
      name: 'Metal' as NonEmptyString,
    });
    await framework.commands.area.create({
      id: managementId,
      name: 'Management' as NonEmptyString,
    });
    await framework.commands.area.addOwner({areaId, memberNumber: OWNER});
    await framework.commands.area.addOwner({
      areaId: otherAreaId,
      memberNumber: OTHER_OWNER,
    });
    await framework.commands.area.addOwner({
      areaId: managementId,
      memberNumber: MANAGER,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      areaId,
      name: 'Saw' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: otherEquipmentId,
      areaId: otherAreaId,
      name: 'Lathe' as NonEmptyString,
    });
    await framework.commands.troubleTickets.create({
      id,
      submittedEquipment: 'Saw',
      submittedMemberNumber: REPORTER,
      submittedEmail: user(REPORTER).emailAddress,
      submittedName: 'Reporter',
      otherEquipmentDetail: '',
      status: 'Broken',
      attempting: 'Cutting',
      issue: 'Private problem',
      steps: '',
    });
  });
  afterEach(() => framework.close());

  const ticket = () => {
    const found = framework.sharedReadModel.troubleTickets.getById(id);
    if (O.isNone(found)) throw new Error('Missing fixture ticket');
    return found.value;
  };
  const mayRead = (number: number) => {
    const member =
      framework.sharedReadModel.members.getByMemberNumber(number);
    if (O.isNone(member)) throw new Error('Missing fixture member');
    return ticketVisibility(
      framework.sharedReadModel,
      deps.conf.MANAGEMENT_TEAM_AREA_ID,
      member.value
    )(ticket());
  };
  const set = async (permission: TicketPermission, by: Actor = admin) =>
    getRightOrFail(
      await applyCommand(deps, setPermission)(
        {ticketId: id, permission},
        by
      )()
    );
  const openBoard = (number: number) =>
    board(deps, {
      page: 1,
      status: O.none,
      only: O.none,
    })(user(number))();

  it('replays a visibility group and its audit entry after rebuilding the read model', async () => {
    await set('manager');
    await framework.sharedReadModel.reset();
    expect(ticket().permission).toBe('manager');
    expect(
      framework.sharedReadModel.troubleTickets.getChangeLog([id])
    ).toEqual([
      expect.objectContaining({
        eventType: 'TroubleTicketPermissionSet',
        actor: admin,
      }),
    ]);
    expect(mayRead(MANAGER)).toBe(true);
    expect(mayRead(REPORTER)).toBe(false);
  });

  it('shows the visibility chosen for each change on the ticket page', async () => {
    await set('everybody');
    await set('manager');
    await set('area-owner');
    await framework.sharedReadModel.reset();

    const view = getRightOrFail(await detail(deps, id)(user(SUPER))());
    expect(view.changeLog.map(entry => entry.summary)).toEqual([
      'changed visibility to Everybody',
      'changed visibility to Management',
      'changed visibility to Area Owners',
    ]);
    const page = renderTicket(view);
    expect(page).toContain('changed visibility to Everybody');
    expect(page).toContain('changed visibility to Management');
    expect(page).toContain('changed visibility to Area Owners');
    expect(page).not.toContain('resolved quietly');
  });

  it('defaults to owners of this ticket’s area', () => {
    expect(ticket().permission).toBe('area-owner');
    expect(mayRead(OWNER)).toBe(true);
    expect(mayRead(OTHER_OWNER)).toBe(false);
    expect(mayRead(REPORTER)).toBe(false);
    expect(mayRead(READER)).toBe(false);
  });

  it('gives every logged-in member access when everybody is selected', async () => {
    await set('everybody');
    expect(mayRead(READER)).toBe(true);
    expect(
      getRightOrFail(await openBoard(READER)).tickets.map(t => t.id)
    ).toEqual([id]);
    expect(E.isRight(await detail(deps, id)(user(READER))())).toBe(true);
  });

  it('limits area-owner visibility to owners of the ticket’s area and super-users', async () => {
    await set('area-owner');
    expect(mayRead(OWNER)).toBe(true);
    expect(mayRead(SUPER)).toBe(true);
    expect(mayRead(READER)).toBe(false);
    expect(mayRead(MANAGER)).toBe(false);
    expect(mayRead(OTHER_OWNER)).toBe(false);
    expect(mayRead(REPORTER)).toBe(false);
  });

  it('replaces the previous group when visibility changes', async () => {
    await set('everybody');
    await set('area-owner');
    expect(ticket().permission).toBe('area-owner');
    expect(mayRead(OWNER)).toBe(true);
    expect(mayRead(READER)).toBe(false);
    await set('manager');
    expect(ticket().permission).toBe('manager');
    expect(mayRead(OWNER)).toBe(false);
    expect(mayRead(MANAGER)).toBe(true);
  });

  it('can share an ordinary equipment ticket only with management', async () => {
    await set('manager');
    expect(mayRead(MANAGER)).toBe(true);
    expect(mayRead(OWNER)).toBe(false);
    expect(mayRead(REPORTER)).toBe(false);
    expect(mayRead(SUPER)).toBe(true);
  });

  it('lets super-users restore access to a restricted ticket', async () => {
    await set('manager');
    expect(mayRead(SUPER)).toBe(true);
    expect(mayRead(OWNER)).toBe(false);
    expect(mayRead(REPORTER)).toBe(false);
    await set('everybody', actor(SUPER));
    expect(mayRead(READER)).toBe(true);
  });

  it('keeps a management grant when equipment changes', async () => {
    await set('manager');
    await framework.commands.troubleTickets.setEquipment({
      ticketId: id,
      equipmentId: otherEquipmentId,
    });
    expect(mayRead(MANAGER)).toBe(true);
    expect(mayRead(OTHER_OWNER)).toBe(false);
  });

  it('resolves area owners from the equipment’s current area', async () => {
    await set('area-owner');
    expect(mayRead(OWNER)).toBe(true);
    await framework.commands.troubleTickets.setEquipment({
      ticketId: id,
      equipmentId: otherEquipmentId,
    });
    expect(mayRead(OWNER)).toBe(false);
    expect(mayRead(OTHER_OWNER)).toBe(true);
  });

  it('uses a directly linked area when there is no equipment', async () => {
    await framework.commands.troubleTickets.setEquipment({
      ticketId: id,
      equipmentId: null,
    });
    await set('area-owner');
    expect(mayRead(OWNER)).toBe(false);
    expect(
      ticketVisibility(
        framework.sharedReadModel,
        deps.conf.MANAGEMENT_TEAM_AREA_ID,
        O.getOrElseW(() => {
          throw new Error('Missing owner');
        })(framework.sharedReadModel.members.getByMemberNumber(OWNER))
      )({...ticket(), areaId})
    ).toBe(true);
  });

  it('removes hidden tickets from the board, counts, focused views and direct URLs', async () => {
    await set('manager');
    const hiddenBoard = getRightOrFail(await openBoard(OWNER));
    expect(hiddenBoard.tickets).toEqual([]);
    expect(hiddenBoard.openCount).toBe(0);
    expect(hiddenBoard.unresolvedEquipmentNames).toEqual([]);
    const focused = getRightOrFail(
      await board(deps, {
        page: 1,
        status: O.none,
        only: O.none,
        equipmentId,
      })(user(OWNER))()
    );
    expect(focused.totalInScope).toBe(0);
    expect(getRightOrFail(await home(deps, {})(user(OWNER))()).active).toBe(
      0
    );
    expect(await detail(deps, id)(user(OWNER))()).toEqual(
      await detail(deps, faker.string.uuid())(user(OWNER))()
    );
    expect(getRightOrFail(await openBoard(MANAGER)).tickets).toHaveLength(1);
  });

  it('allows an area owner with access to change visibility', async () => {
    await set('area-owner');
    await set('manager', actor(OWNER));
    expect(mayRead(MANAGER)).toBe(true);
    expect(mayRead(OWNER)).toBe(false);
  });

  it('saves an inline visibility change and returns an owner to the ticket', async () => {
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response<CompleteHtmlDocument>;
    await setPermissionPost(deps)(
      {
        session: {passport: {user: user(OWNER)}},
        body: {ticketId: id, permission: 'everybody'},
        query: {},
      } as unknown as Request,
      res
    );
    expect(ticket().permission).toBe('everybody');
    expect(res.redirect).toHaveBeenCalledWith(`/trouble-tickets/view/${id}`);
  });

  it('returns to the board when an inline change removes the owner’s access', async () => {
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response<CompleteHtmlDocument>;
    await setPermissionPost(deps)(
      {
        session: {passport: {user: user(OWNER)}},
        body: {ticketId: id, permission: 'manager'},
        query: {},
      } as unknown as Request,
      res
    );
    expect(ticket().permission).toBe('manager');
    expect(mayRead(OWNER)).toBe(false);
    expect(res.redirect).toHaveBeenCalledWith('/trouble-tickets/board');
  });

  it('keeps a super-user on the ticket after choosing Management', async () => {
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response<CompleteHtmlDocument>;
    await setPermissionPost(deps)(
      {
        session: {passport: {user: user(SUPER)}},
        body: {ticketId: id, permission: 'manager'},
        query: {},
      } as unknown as Request,
      res
    );
    expect(ticket().permission).toBe('manager');
    expect(res.redirect).toHaveBeenCalledWith(`/trouble-tickets/view/${id}`);
  });

  it('refuses an inline visibility change from a reader without edit permission', async () => {
    await set('everybody');
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response<CompleteHtmlDocument>;
    await setPermissionPost(deps)(
      {
        session: {passport: {user: user(READER)}},
        body: {ticketId: id, permission: 'manager'},
        query: {},
      } as unknown as Request,
      res
    );
    expect(ticket().permission).toBe('everybody');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('does not let a hidden area owner grant themselves access or work the ticket', async () => {
    await set('manager');
    const request = {
      actor: actor(OWNER),
      rm: framework.sharedReadModel,
      deps,
      input: {ticketId: id},
    };
    expect(isTicketOwner(request)).toBe(false);
    expect(
      canSetTicketEquipment({...request, input: {ticketId: id, equipmentId}})
    ).toBe(false);
    const result = await applyCommand(deps, setPermission)(
      {
        ticketId: id,
        permission: 'everybody',
      },
      actor(OWNER)
    )();
    expect(E.isLeft(result)).toBe(true);
    expect(mayRead(OWNER)).toBe(false);
    expect(
      E.isLeft(
        await permissionForm.constructForm({ticketId: id})({
          user: user(OWNER),
          deps,
          readModel: framework.sharedReadModel,
        })()
      )
    ).toBe(true);
  });

  it('grants reading without granting permission to edit visibility or status', async () => {
    await set('everybody');
    expect(mayRead(READER)).toBe(true);
    expect(
      isTicketOwner({
        actor: actor(READER),
        rm: framework.sharedReadModel,
        deps,
        input: {ticketId: id},
      })
    ).toBe(false);
    expect(
      E.isLeft(
        await applyCommand(deps, setPermission)(
          {
            ticketId: id,
            permission: 'manager',
          },
          actor(READER)
        )()
      )
    ).toBe(true);
  });

  it('refuses an unconfigured management group', async () => {
    expect(
      E.isLeft(
        await applyCommand(
          {...deps, conf: {...deps.conf, MANAGEMENT_TEAM_AREA_ID: ''}},
          setPermission
        )(
          {
            ticketId: id,
            permission: 'manager',
          },
          admin
        )()
      )
    ).toBe(true);
    expect(ticket().permission).toBe('area-owner');
  });

  it('does not email a reporter or owner who has lost read access', async () => {
    await set('manager');
    const audience = audienceFor(
      framework.sharedReadModel,
      ticket(),
      'resolved',
      {
        managementAreaId: deps.conf.MANAGEMENT_TEAM_AREA_ID,
      }
    );
    expect(audience.map(entry => entry.memberNumber)).not.toContain(REPORTER);
    expect(audience.map(entry => entry.memberNumber)).not.toContain(OWNER);
  });

  it('does not let an old claim link reveal a newly restricted ticket', async () => {
    const token = new URL(claimUrl(deps.conf, id)).searchParams.get('token')!;
    await set('manager');
    expect(
      E.isLeft(
        await claimForm.constructForm({token})({
          user: user(REPORTER),
          deps,
          readModel: framework.sharedReadModel,
        })()
      )
    ).toBe(true);
    expect(
      E.isLeft(await applyCommand(deps, claim)({token}, actor(REPORTER))())
    ).toBe(true);
  });

  it('renders and saves exactly one visibility group', async () => {
    await set('area-owner');
    const form = permissionForm.renderForm(
      getRightOrFail(
        await permissionForm.constructForm({ticketId: id})({
          user: user(OWNER),
          deps,
          readModel: framework.sharedReadModel,
        })()
      )
    );
    expect(form.body).toContain('Who can view this ticket?');
    expect(form.body.match(/type="radio"/g)).toHaveLength(3);
    expect(form.body.match(/\bchecked\b/g)).toHaveLength(1);
    expect(form.body).toMatch(/value="area-owner"\s+required\s+checked/);
    expect(form.body).not.toContain('name="memberNumbers"');
    const decoded = getRightOrFail(
      setPermission.decode({
        ticketId: id,
        permission: 'manager',
      })
    );
    await set(decoded.permission, actor(OWNER));
    expect(ticket().permission).toBe('manager');
  });
});

describe('permission input validation', () => {
  const ticketId = faker.string.uuid();
  it('rejects unknown groups instead of falling back to wider access', () => {
    expect(
      E.isLeft(
        setPermission.decode({
          ticketId,
          permission: 'unknown',
        })
      )
    ).toBe(true);
  });
  it('rejects lists, null and missing permission', () => {
    expect(
      E.isLeft(
        setPermission.decode({
          ticketId,
          permission: ['everybody', 'manager'],
        })
      )
    ).toBe(true);
    expect(E.isLeft(setPermission.decode({ticketId, permission: null}))).toBe(
      true
    );
    expect(E.isLeft(setPermission.decode({ticketId}))).toBe(true);
  });
  it('rejects the previous individual and group entry formats', () => {
    expect(
      E.isLeft(
        setPermission.decode({
          ticketId,
          permission: [{type: 'member', memberNumber: READER}],
        })
      )
    ).toBe(true);
    expect(
      E.isLeft(
        setPermission.decode({
          ticketId,
          permission: [{type: 'group', group: 'everybody'}],
        })
      )
    ).toBe(true);
  });
  it('requires a non-empty selection', () => {
    expect(E.isLeft(setPermission.decode({ticketId, permission: ''}))).toBe(
      true
    );
    expect(E.isLeft(setPermission.decode({ticketId, permission: []}))).toBe(
      true
    );
  });
});
