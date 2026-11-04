import {Request, Response} from 'express';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {initRoutes} from '../../src/routes';
import {TestFramework, initTestFramework} from '../read-models/test-framework';

// The trouble tickets front door is what a QR code on a machine opens, so it
// has to work on a phone that has never logged in. Reporting is open to
// anybody; what is already open, and what you hear about, are for members.
describe('the trouble tickets page for somebody not logged in', () => {
  let framework: TestFramework;
  let bandsawId: UUID;

  const visit = (query: Record<string, string> = {}) => {
    const route = initRoutes(
      framework.depsForCommands,
      framework.depsForCommands.conf
    ).find(
      candidate =>
        candidate.method === 'get' && candidate.path === '/trouble-tickets'
    );
    const sent: {status?: number; body?: string; redirect?: string} = {};
    const res = {
      status: (code: number) => {
        sent.status = code;
        return res;
      },
      send: (body: string) => {
        sent.body = body;
        return res;
      },
      redirect: (to: string) => {
        sent.redirect = to;
      },
    } as unknown as Response;
    const search = new URLSearchParams(query).toString();
    const req = {
      session: null,
      query,
      originalUrl: `/trouble-tickets${search === '' ? '' : `?${search}`}`,
    } as unknown as Request;
    route?.handler(req, res, () => undefined);
    return sent;
  };

  beforeEach(async () => {
    framework = await initTestFramework();
    const areaId = faker.string.uuid() as UUID;
    bandsawId = faker.string.uuid() as UUID;
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: bandsawId,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    await framework.commands.troubleTickets.create({
      id: faker.string.uuid() as UUID,
      submittedMemberNumber: null,
      submittedEmail: 'someone@example.com',
      submittedName: 'Someone',
      submittedEquipment: 'Band Saw',
      otherEquipmentDetail: '',
      status: 'Broken',
      attempting: '',
      issue: 'The blade wobbles alarmingly',
      steps: '',
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('is shown, rather than sending them to log in', () => {
    const page = visit();
    expect(page.redirect).toBeUndefined();
    expect(page.status).toStrictEqual(200);
    expect(page.body).toContain('Submit a trouble ticket');
  });

  it('reports a problem with the machine its QR code names', () => {
    const page = visit({equipmentId: 'wood-shop-band-saw'});
    expect(page.body).toContain('Report a problem with Band Saw');
    expect(page.body).toContain(
      `/trouble-tickets/raise?equipmentId=${bandsawId}`
    );
  });

  it('shows nothing about the tickets already open', () => {
    const page = visit();
    expect(page.body).not.toContain('The blade wobbles alarmingly');
    expect(page.body).not.toContain('tt-home__stat');
    expect(page.body).not.toContain('/trouble-tickets/board');
  });

  it('asks them to log in to see tickets, and comes back to the same machine', () => {
    const page = visit({equipmentId: 'wood-shop-band-saw'});
    expect(page.body).toContain(
      `/log-in?next=${encodeURIComponent('/trouble-tickets?equipmentId=wood-shop-band-saw')}`
    );
  });

  it('asks them to log in to change what they hear about', () => {
    expect(visit().body).toContain(
      `/log-in?next=${encodeURIComponent('/notification-settings')}`
    );
  });
});
