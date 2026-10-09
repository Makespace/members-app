import {createHash} from 'node:crypto';
import express from 'express';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {equipmentTroubleTicketsImage} from '../../src/eink/equipment-trouble-tickets-handler';
import {constructEvent} from '../../src/types/domain-event';
import {arbitraryActor} from '../helpers';
import {initTestFramework, TestFramework} from '../read-models/test-framework';
import {serve} from './serve';

// What a display's firmware relies on (docs/eink-displays.md), checked over
// real HTTP so the parts express adds itself - 304 Not Modified - are covered.

const header = (png: Buffer) => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
  bitDepth: png[24],
  colourType: png[25],
  interlace: png[28],
});

describe('the e-ink display contract', () => {
  let framework: TestFramework;
  let server: Awaited<ReturnType<typeof serve>>;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;

  const getImage = (query = '', headers: Record<string, string> = {}) =>
    server.get(`/equipment/${equipmentId}/trouble-tickets.png${query}`, headers);

  const raiseTicket = () =>
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketCreated')({
        source: 'app',
        equipmentId,
        machine: '',
        areaId: null,
        title: 'Blade guide is loose',
        mailboxConversationId: '',
        actor: arbitraryActor(),
        id: faker.string.uuid() as UUID,
        rowHash: faker.string.hexadecimal({length: 64}),
        sheetId: '',
        submittedAt: new Date('2026-09-01'),
        submittedMemberNumber: null,
        submittedEmail: null,
        submittedName: null,
        submittedEquipment: 'Band Saw',
        otherEquipmentDetail: '',
        status: 'Broken',
        attempting: '',
        issue: 'Blade guide is loose',
        steps: '',
      })
    );

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    const app = express();
    app.get(
      '/equipment/:equipment/trouble-tickets.png',
      equipmentTroubleTicketsImage(framework.depsForCommands)
    );
    server = await serve(app);
  });

  afterEach(async () => {
    await server.close();
    framework.close();
  });

  it('answers with a PNG exactly the size the display asked for', async () => {
    const response = await getImage('?width=1280&height=720');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    const png = response.body;
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
    expect(header(png)).toMatchObject({width: 1280, height: 720});
  });

  it('is greyscale, non-interlaced, two bits per pixel', async () => {
    const png = (await getImage()).body;
    expect(header(png)).toMatchObject({
      bitDepth: 2,
      colourType: 0,
      interlace: 0,
    });
  });

  it('is 1-bit greyscale, non-interlaced, for a display that asks for two tones', async () => {
    const png = (await getImage('?tones=2')).body;
    expect(header(png)).toMatchObject({
      bitDepth: 1,
      colourType: 0,
      interlace: 0,
    });
  });

  it('tags the image with a hash of its bytes', async () => {
    const response = await getImage();
    const hash = createHash('sha256').update(response.body).digest('hex');
    expect(response.headers.etag).toBe(`"${hash.slice(0, 32)}"`);
  });

  it('answers 304 Not Modified, with no body, when the display already has the image', async () => {
    const etag = (await getImage()).headers.etag!;
    const response = await getImage('', {'If-None-Match': etag});
    expect(response.status).toBe(304);
    expect(response.headers.etag).toBe(etag);
    expect(response.body.length).toBe(0);
  });

  it('sends the image again once a ticket changes it', async () => {
    const etag = (await getImage()).headers.etag!;
    raiseTicket();
    const response = await getImage('', {'If-None-Match': etag});
    expect(response.status).toBe(200);
    expect(response.headers.etag).not.toBe(etag);
  });

  it('asks anything in between to check back rather than serve a stored copy', async () => {
    const response = await getImage();
    expect(response.headers['cache-control']).toBe('no-cache');
  });
});
