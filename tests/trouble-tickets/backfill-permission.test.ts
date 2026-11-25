import {Int} from 'io-ts';
import {Request, RequestHandler, Response} from 'express';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent, DomainEvent} from '../../src/types';
import {EventOfType} from '../../src/types/domain-event';
import {TroubleTicket} from '../../src/types/trouble-ticket';
import {backfillTicketPermission} from '../../src/trouble-tickets/backfill-permission';
import {initRoutes} from '../../src/routes';
import {getRightOrFail} from '../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../read-models/test-framework';

describe('ticket permission backfill', () => {
  let framework: TestFramework;
  let managementId: UUID;
  let areaId: UUID;
  let equipmentId: UUID;

  const commit = async (event: DomainEvent) =>
    getRightOrFail(
      await framework.depsForCommands.commitEvent(
        framework.sharedReadModel.getCurrentEventIndex()
      )(event)()
    );
  const add = async (
    fields: Partial<EventOfType<'TroubleTicketCreated'>> = {}
  ) => {
    const event = constructEvent('TroubleTicketCreated')({
      id: faker.string.uuid() as UUID,
      permission: undefined, // A stored creation event from before visibility.
      rowHash: faker.string.uuid(),
      sheetId: 'sheet',
      submittedAt: new Date(),
      submittedMemberNumber: null,
      providedMemberNumber: null,
      submittedEmail: null,
      submittedName: null,
      submittedEquipment: null,
      otherEquipmentDetail: '',
      status: '',
      attempting: '',
      issue: 'Broken',
      steps: '',
      source: 'sheet',
      equipmentId: null,
      machine: '',
      areaId: null,
      title: '',
      mailboxConversationId: '',
      actor: {tag: 'system'},
      ...fields,
    });
    await commit(event);
    return event.id;
  };
  const run = (dryRun = false) =>
    backfillTicketPermission(framework.depsForCommands)({dryRun});
  const ticket = (id: UUID) =>
    framework.sharedReadModel.troubleTickets.getAll().find(t => t.id === id)!;

  beforeEach(async () => {
    framework = await initTestFramework();
    managementId = faker.string.uuid() as UUID;
    areaId = faker.string.uuid() as UUID;
    equipmentId = faker.string.uuid() as UUID;
    framework.depsForCommands.conf.MANAGEMENT_TEAM_AREA_ID = managementId;
    await framework.commands.area.create({
      id: managementId,
      name: 'Management' as NonEmptyString,
    });
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      areaId,
      name: 'Saw' as NonEmptyString,
    });
  });
  afterEach(() => framework.close());

  describe('admin endpoint', () => {
    let handler: RequestHandler;
    let id: UUID;

    const request = async (
      query: Request['query'] = {},
      headers: Request['headers'] = {authorization: 'Bearer test-admin-token'}
    ) => {
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
      const next = jest.fn();
      await Promise.resolve(
        handler({query, headers} as Request, res as unknown as Response, next)
      );
      expect(next).not.toHaveBeenCalled();
      return res;
    };

    beforeEach(async () => {
      framework.depsForCommands.conf.ADMIN_API_BEARER_TOKEN =
        'test-admin-token' as NonEmptyString;
      handler = initRoutes(
        framework.depsForCommands,
        framework.depsForCommands.conf
      ).find(
        route =>
          route.method === 'post' &&
          route.path === '/api/trouble-tickets/backfill-permission'
      )!.handler;
      id = await add({equipmentId});
    });

    it('requires an admin API token', async () => {
      const before = await framework.getAllEvents();
      const res = await request({}, {});
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({message: 'Bad Bearer Token'});
      expect(await framework.getAllEvents()).toEqual(before);
    });

    it('rejects an incorrect token', async () => {
      const before = await framework.getAllEvents();
      const res = await request({}, {authorization: 'Bearer wrong-token'});
      expect(res.status).toHaveBeenCalledWith(401);
      expect(await framework.getAllEvents()).toEqual(before);
    });

    it('previews without appending events when dryRun is true', async () => {
      const before = await framework.getAllEvents();
      const res = await request({dryRun: 'true'});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        candidates: 1,
        backfilled: 0,
        skipped: 0,
        failed: 0,
        groups: {'area-owner': 1, manager: 0},
      });
      expect(await framework.getAllEvents()).toEqual(before);
    });

    it('rejects other dryRun values without appending events', async () => {
      const before = await framework.getAllEvents();
      for (const dryRun of ['false', '', ['true', 'true'], {value: 'true'}]) {
        const res = await request({dryRun});
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
          message: "dryRun must be exactly 'true'",
        });
      }
      expect(await framework.getAllEvents()).toEqual(before);
    });

    it('applies once as the admin token actor when dryRun is omitted', async () => {
      const before = await framework.getAllEvents();
      const res = await request();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({backfilled: 1, failed: 0})
      );
      const after = await framework.getAllEvents();
      expect(after.slice(before.length)).toEqual([
        expect.objectContaining({
          type: 'TroubleTicketPermissionSet',
          ticketId: id,
          permission: 'area-owner',
          actor: {tag: 'token', token: 'admin'},
        }),
      ]);
      await request();
      expect(await framework.getAllEvents()).toEqual(after);
    });
  });

  it('previews, appends and replays group choices without rewriting old events', async () => {
    const ordinary = await add({equipmentId});
    const management = await add({areaId: managementId});
    const unassigned = await add();
    const resolved = await add({areaId});
    await commit(
      constructEvent('TroubleTicketResolved')({
        ticketId: resolved,
        summary: '',
        quiet: true,
        actor: {tag: 'system'},
      })
    );
    const original = await framework.getAllEvents();
    expect(ticket(ordinary).permission).toBe('manager');
    expect(await run(true)).toMatchObject({
      candidates: 4,
      backfilled: 0,
      groups: {manager: 1, 'area-owner': 3},
    });
    expect(await framework.getAllEvents()).toEqual(original);
    expect(await run()).toMatchObject({backfilled: 4, failed: 0});
    expect(
      (await framework.getAllEvents()).slice(0, original.length)
    ).toEqual(original);
    await framework.sharedReadModel.reset();
    expect(ticket(ordinary).permission).toBe('area-owner');
    expect(ticket(management).permission).toBe('manager');
    expect(ticket(unassigned).permission).toBe('area-owner');
    expect(ticket(resolved).permission).toBe('area-owner');
    expect(await run()).toMatchObject({
      candidates: 0,
      backfilled: 0,
      skipped: 4,
    });
  });

  it('uses the current effective area after reassignment and equipment resolution', async () => {
    const reassigned = await add({areaId: managementId});
    await commit(
      constructEvent('TroubleTicketEquipmentSet')({
        ticketId: reassigned,
        equipmentId,
        actor: {tag: 'system'},
      })
    );
    await framework.commands.equipment.add({
      id: faker.string.uuid() as UUID,
      areaId: managementId,
      name: 'Management equipment' as NonEmptyString,
    });
    const managementEquipment = await add({
      submittedEquipment: 'Management equipment',
    });
    await run();
    expect(ticket(reassigned).permission).toBe('area-owner');
    expect(ticket(managementEquipment).permission).toBe('manager');
  });

  it('preserves saved choices and skips tickets created with an explicit permission', async () => {
    const edited = await add({equipmentId});
    await commit(
      constructEvent('TroubleTicketPermissionSet')({
        ticketId: edited,
        permission: 'everybody',
        actor: {tag: 'system'},
      })
    );
    const newTicket = await add({equipmentId, permission: 'manager'});
    const before = await framework.getAllEvents();
    expect(await run()).toMatchObject({candidates: 0, backfilled: 0});
    expect(ticket(edited).permission).toBe('everybody');
    expect(ticket(newTicket).permission).toBe('manager');
    expect(await framework.getAllEvents()).toEqual(before);
  });

  it('does not overwrite a choice committed concurrently with the migration', async () => {
    const id = await add({equipmentId});
    const realCommit = framework.depsForCommands.commitEvent;
    const summary = await backfillTicketPermission({
      ...framework.depsForCommands,
      commitEvent: index => event => async () => {
        await commit(
          constructEvent('TroubleTicketPermissionSet')({
            ticketId: id,
            permission: 'everybody',
            actor: {tag: 'system'},
          })
        );
        return realCommit(index)(event)();
      },
    })({dryRun: false});
    expect(summary).toMatchObject({backfilled: 0, failed: 1});
    expect(ticket(id).permission).toBe('everybody');
    expect(await run()).toMatchObject({backfilled: 0, skipped: 1});
  });

  it('ignores deleted tickets and permits backfilling again if a choice is deleted', async () => {
    const deleted = await add();
    const retained = await add({equipmentId});
    const creation = (await framework.getAllEvents()).find(
      event => event.type === 'TroubleTicketCreated' && event.id === deleted
    )!;
    getRightOrFail(
      await framework.depsForCommands.deleteEvent(
        creation.event_index,
        'test deletion',
        1 as Int
      )()
    );
    expect(await run()).toMatchObject({candidates: 1, backfilled: 1});
    expect(ticket(deleted)).toBeUndefined();
    expect(ticket(retained).permission).toBe('area-owner');
    const choice = (await framework.getAllEvents()).find(
      event =>
        event.type === 'TroubleTicketPermissionSet' &&
        event.ticketId === retained
    )!;
    getRightOrFail(
      await framework.depsForCommands.deleteEvent(
        choice.event_index,
        'test deletion',
        1 as Int
      )()
    );
    expect(await run()).toMatchObject({backfilled: 1});
    expect(ticket(retained).permission).toBe('area-owner');
  });

  it('rejects null or missing permission in ticket data, but decodes legacy creation events', async () => {
    const id = await add({equipmentId});
    const data = {
      ...ticket(id),
      submittedAt: ticket(id).submittedAt.toISOString(),
    };
    expect(E.isRight(TroubleTicket.decode(data))).toBe(true);
    expect(E.isLeft(TroubleTicket.decode({...data, permission: null}))).toBe(
      true
    );
    expect(
      E.isLeft(TroubleTicket.decode({...data, permission: undefined}))
    ).toBe(true);
    expect(
      E.isLeft(TroubleTicket.decode({...data, permission: 'owners'}))
    ).toBe(true);
    const creation = (await framework.getAllEvents()).find(
      event => event.type === 'TroubleTicketCreated' && event.id === id
    )!;
    expect(
      E.isRight(DomainEvent.decode(JSON.parse(JSON.stringify(creation))))
    ).toBe(true);
  });
});
