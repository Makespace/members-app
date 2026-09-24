import {faker} from '@faker-js/faker';
import createLogger from 'pino';
import {NonEmptyString, UUID} from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {checkGuideLinks} from '../../src/sync-worker/guide-links/check_guide_links';
import {getGuideLinkChecks} from '../../src/read-models/external-state/guide-links';
import {
  TestFramework,
  initTestFramework,
} from '../read-models/test-framework';

// The address on a sign is scanned off a machine months after it was printed,
// so the app looks at each one daily and remembers what it found.
describe('checking the recorded equipment guide addresses', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const bandSaw = faker.string.uuid() as UUID;
  const lathe = faker.string.uuid() as UUID;
  const logger = createLogger({level: 'silent'});
  const realFetch = global.fetch;
  let answers: Record<string, number | 'throws'>;

  const run = () =>
    checkGuideLinks({
      sharedReadModel: framework.sharedReadModel,
      extDB: framework.extDB,
      logger,
    });

  const checks = () => getGuideLinkChecks(framework.extDB)();

  beforeEach(async () => {
    answers = {};
    global.fetch = ((url: string) => {
      const answer = answers[String(url)];
      if (answer === 'throws') {
        return Promise.reject(new Error('getaddrinfo ENOTFOUND'));
      }
      const status = answer ?? 404;
      return Promise.resolve({
        status,
        ok: status >= 200 && status < 300,
      } as Response);
    }) as unknown as typeof global.fetch;

    framework = await initTestFramework();
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    for (const [id, name] of [
      [bandSaw, 'Band Saw'],
      [lathe, 'Wood Lathe'],
    ] as const) {
      await framework.commands.equipment.add({
        id,
        name: name as NonEmptyString,
        areaId,
      });
    }
  });

  afterEach(() => {
    global.fetch = realFetch;
    framework.close();
  });

  const record = (equipmentId: UUID, guideUrl: string) =>
    framework.commands.equipment.setGuideUrl({equipmentId, guideUrl});

  it('remembers a link that answered', async () => {
    const url = 'https://equipment.makespace.org/wood-shop/band-saw';
    answers[url] = 200;
    await record(bandSaw, url);

    await run();

    const check = (await checks()).get(bandSaw);
    expect(check?.reachable).toBe(true);
    expect(check?.status).toStrictEqual(O.some(200));
    expect(check?.url).toBe(url);
  });

  it('remembers one that did not, with the status it gave', async () => {
    const url = 'https://equipment.makespace.org/wood-shop/gone';
    answers[url] = 404;
    await record(bandSaw, url);

    await run();

    const check = (await checks()).get(bandSaw);
    expect(check?.reachable).toBe(false);
    expect(check?.status).toStrictEqual(O.some(404));
  });

  // No status at all: DNS gone, connection refused, site down.
  it('records a request that never got an answer as unreachable', async () => {
    const url = 'https://equipment.makespace.invalid/wood-shop/band-saw';
    answers[url] = 'throws';
    await record(bandSaw, url);

    await run();

    const check = (await checks()).get(bandSaw);
    expect(check?.reachable).toBe(false);
    expect(check?.status).toStrictEqual(O.none);
  });

  it('leaves machines with no address recorded out of it', async () => {
    answers['https://equipment.makespace.org/wood-shop/band-saw'] = 200;
    await record(bandSaw, 'https://equipment.makespace.org/wood-shop/band-saw');

    await run();

    const all = await checks();
    expect(all.has(bandSaw)).toBe(true);
    expect(all.has(lathe)).toBe(false);
  });

  // A "not reachable" that outlives the link it was about would be a warning
  // about nothing, shown next to an address that no longer exists.
  it('forgets a link once its address is cleared', async () => {
    const url = 'https://equipment.makespace.org/wood-shop/gone';
    answers[url] = 404;
    await record(bandSaw, url);
    await run();
    expect((await checks()).has(bandSaw)).toBe(true);

    await record(bandSaw, '');
    await run();

    expect((await checks()).has(bandSaw)).toBe(false);
  });

  it('replaces the previous result rather than piling them up', async () => {
    const url = 'https://equipment.makespace.org/wood-shop/band-saw';
    answers[url] = 404;
    await record(bandSaw, url);
    await run();

    answers[url] = 200;
    await run();

    const all = await checks();
    expect(all.size).toBe(1);
    expect(all.get(bandSaw)?.reachable).toBe(true);
  });
});
