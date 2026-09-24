#!/usr/bin/env bun
/**
 * Checks that every machine's equipment-guide address actually exists.
 *
 * The address is recorded against each machine and printed on its sign, so a
 * link that has gone stale is a dead QR code on a poster stuck to a machine.
 * This reports both kinds of problem: machines with no address recorded, and
 * addresses that no longer resolve.
 *
 * Usage:
 *   ./scripts/audit-guide-urls.ts <shared-db-dump.json> [--json]
 *
 * The dump comes from /debug/dump-shared-db/json on the environment being
 * audited (super-user only). It contains member data as well, so delete it
 * when you are done; this script reads only the equipment and area tables and
 * prints nothing else.
 */
import {readFileSync} from 'fs';
import {EquipmentCategory} from '../src/types/equipment-category';

type Row = Record<string, unknown>;

const CONCURRENCY = 6;

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

type Check = {
  area: string;
  name: string;
  category: EquipmentCategory;
  url: string | null;
  status: number | string | null;
};

const check = async (item: Omit<Check, 'status'>): Promise<Check> => {
  if (item.url === null) {
    return {...item, status: null};
  }
  try {
    const response = await fetch(item.url, {redirect: 'follow'});
    return {...item, status: response.status};
  } catch (error) {
    return {...item, status: `failed: ${String(error)}`};
  }
};

const inBatches = async <T, R>(
  items: ReadonlyArray<T>,
  size: number,
  run: (item: T) => Promise<R>
): Promise<ReadonlyArray<R>> => {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  }
  return results;
};

const main = async () => {
  const [, , path, ...flags] = process.argv;
  if (!path) {
    console.error('usage: ./scripts/audit-guide-urls.ts <dump.json> [--json]');
    return 1;
  }

  const dump = JSON.parse(readFileSync(path, 'utf8')) as Record<string, Row[]>;
  const areas = new Map(
    (dump.areasTable ?? []).map(area => [asString(area.id), asString(area.name)])
  );
  const equipment = (dump.equipmentTable ?? [])
    // A retired machine is not getting a new sign, so its guide does not
    // matter.
    .filter(item => item.removedAt === null || item.removedAt === undefined)
    .map(item => ({
      area: areas.get(asString(item.areaId)) ?? '(unknown area)',
      name: asString(item.name),
      category: asString(item.category) as EquipmentCategory,
      guideUrl: item.guideUrl,
    }))
    .map(item => ({
      ...item,
      url: typeof item.guideUrl === 'string' ? item.guideUrl : null,
    }))
    .sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name));

  console.error(`Checking ${equipment.length} guide addresses...`);
  const results = await inBatches(equipment, CONCURRENCY, check);

  if (flags.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
    return 0;
  }

  const unset = results.filter(result => result.url === null);
  const dead = results.filter(
    result => result.url !== null && result.status !== 200
  );
  const found = results.length - unset.length - dead.length;

  for (const result of results) {
    const mark =
      result.url === null ? 'none' : result.status === 200 ? 'ok  ' : 'DEAD';
    console.log(
      `${mark} ${String(result.status ?? '-').padEnd(6)} ${result.area} / ${result.name}\n     ${result.url ?? 'no guide address recorded'}`
    );
  }

  console.log(
    `\n${found} of ${results.length} guides reachable; ${dead.length} dead, ${unset.length} not recorded.`
  );
  return 0;
};

void (async () => {
  process.exitCode = await main();
})();
