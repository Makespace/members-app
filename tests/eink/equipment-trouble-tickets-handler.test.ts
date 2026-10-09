import {EventEmitter} from 'node:events';
import {faker} from '@faker-js/faker';
import {Request, Response} from 'express';
import * as E from 'fp-ts/Either';
import {NonEmptyString, UUID} from 'io-ts-types';
import {
  equipmentTroubleTicketsImage,
  parseDisplayOptions,
} from '../../src/eink/equipment-trouble-tickets-handler';
import {constructEvent} from '../../src/types/domain-event';
import {arbitraryActor} from '../helpers';
import {initTestFramework, TestFramework} from '../read-models/test-framework';

type FakeResponse = Response & {
  status: jest.Mock;
  setHeader: jest.Mock<unknown, [string, string]>;
  type: jest.Mock;
  send: jest.Mock<unknown, [Buffer]>;
};

const makeRes = (): FakeResponse =>
  ({
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }) as unknown as FakeResponse;

const makeReq = (
  equipment: string,
  query: Record<string, string>
): Request => ({params: {equipment}, query}) as unknown as Request;

describe('parseDisplayOptions', () => {
  it('defaults to 800x480 in four tones, answered at once', () => {
    expect(parseDisplayOptions({})).toStrictEqual(
      E.right({width: 800, height: 480, tones: 4, wait: 0})
    );
  });

  it('reads width and height', () => {
    expect(parseDisplayOptions({width: '296', height: '128'})).toStrictEqual(
      E.right({width: 296, height: 128, tones: 4, wait: 0})
    );
  });

  it('reads two tones for a black-and-white panel', () => {
    expect(parseDisplayOptions({tones: '2'})).toStrictEqual(
      E.right({width: 800, height: 480, tones: 2, wait: 0})
    );
  });

  it('reads how long a display will wait for a change', () => {
    expect(parseDisplayOptions({wait: '30'})).toStrictEqual(
      E.right({width: 800, height: 480, tones: 4, wait: 30})
    );
  });

  it('holds a display for at most 55 seconds, however long it offers', () => {
    expect(parseDisplayOptions({wait: '600'})).toStrictEqual(
      E.right({width: 800, height: 480, tones: 4, wait: 55})
    );
  });

  it.each([
    [{width: 'wide'}],
    [{width: '12.5'}],
    [{height: '10'}],
    [{height: '5000'}],
    [{width: ['300', '400']}],
    [{tones: '3'}],
    [{tones: 'two'}],
    [{tones: ['2', '4']}],
    [{wait: 'soon'}],
    [{wait: '-1'}],
    [{wait: '1.5'}],
    [{wait: ['5', '6']}],
  ])('rejects %j', query => {
    expect(E.isLeft(parseDisplayOptions(query))).toBe(true);
  });
});

describe('equipmentTroubleTicketsImage', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;

  const handle = (req: Request) => {
    const res = makeRes();
    equipmentTroubleTicketsImage(framework.depsForCommands)(req, res);
    return res;
  };

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
  });

  afterEach(() => framework.close());

  it('serves a PNG to anyone, without a login', () => {
    const res = handle(
      makeReq(equipmentId, {width: '296', height: '128'})
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.type).toHaveBeenCalledWith('image/png');
    const png = res.send.mock.calls[0][0];
    expect(png.readUInt32BE(16)).toBe(296);
    expect(png.readUInt32BE(20)).toBe(128);
  });

  it('finds the machine by its slug too', () => {
    const res = handle(makeReq('wood-shop-band-saw', {}));
    expect(res.type).toHaveBeenCalledWith('image/png');
  });

  it('answers 404 for an unknown machine', () => {
    const res = handle(makeReq(faker.string.uuid(), {}));
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('answers 400 for a size it cannot draw', () => {
    const res = handle(makeReq(equipmentId, {width: 'huge'}));
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('answers 400 for tones it cannot draw', () => {
    const res = handle(makeReq(equipmentId, {tones: '16'}));
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('changes its ETag when a ticket is raised against the machine', () => {
    const etag = (res: FakeResponse) =>
      res.setHeader.mock.calls.find(([name]) => name === 'ETag')?.[1];
    const before = etag(handle(makeReq(equipmentId, {})));
    expect(etag(handle(makeReq(equipmentId, {})))).toBe(before);

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

    expect(etag(handle(makeReq(equipmentId, {})))).not.toBe(
      before
    );
  });
});

describe('equipmentTroubleTicketsImage for a display that asks to wait', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;

  // A response that can be hung up on, like a real one.
  type HoldableResponse = FakeResponse & EventEmitter;
  const makeHoldableRes = (): HoldableResponse =>
    Object.assign(new EventEmitter(), makeRes()) as HoldableResponse;

  const request = (query: Record<string, string>, ifNoneMatch?: string) =>
    ({
      params: {equipment: equipmentId},
      query,
      headers: ifNoneMatch === undefined ? {} : {'if-none-match': ifNoneMatch},
    }) as unknown as Request;

  const handle = (req: Request) => {
    const res = makeHoldableRes();
    equipmentTroubleTicketsImage(framework.depsForCommands)(req, res);
    return res;
  };

  const etagOf = (res: FakeResponse) =>
    res.setHeader.mock.calls.find(([name]) => name === 'ETag')?.[1];

  const raiseTicket = (onEquipment: UUID) =>
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketCreated')({
        source: 'app',
        equipmentId: onEquipment,
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

  let currentEtag: string;

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
    currentEtag = etagOf(handle(request({})))!;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    framework.close();
  });

  it('answers at once when the display does not have the image yet', () => {
    const res = handle(request({wait: '30'}, '"an-old-image"'));
    expect(res.send).toHaveBeenCalledTimes(1);
  });

  it('answers at once when the display did not ask to wait', () => {
    const res = handle(request({}, currentEtag));
    expect(res.send).toHaveBeenCalledTimes(1);
  });

  describe('when the display already has the image', () => {
    let res: HoldableResponse;

    beforeEach(() => {
      res = handle(request({wait: '30'}, currentEtag));
    });

    it('holds the request', () => {
      jest.advanceTimersByTime(29_000);
      expect(res.send).not.toHaveBeenCalled();
    });

    it('gives the same image back when the wait runs out, which express answers as 304', () => {
      jest.advanceTimersByTime(30_000);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(etagOf(res)).toBe(currentEtag);
    });

    it('sends the new image as soon as a ticket changes it', () => {
      jest.advanceTimersByTime(5_000);
      raiseTicket(equipmentId);
      jest.advanceTimersByTime(1_000);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(etagOf(res)).not.toBe(currentEtag);
    });

    it('keeps holding through changes that leave its image as it was', () => {
      raiseTicket(faker.string.uuid() as UUID);
      jest.advanceTimersByTime(5_000);
      expect(res.send).not.toHaveBeenCalled();
    });

    it('stops checking once the display hangs up', () => {
      res.emit('close');
      raiseTicket(equipmentId);
      jest.advanceTimersByTime(60_000);
      expect(res.send).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
