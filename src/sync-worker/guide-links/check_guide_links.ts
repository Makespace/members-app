import * as O from 'fp-ts/Option';
import {eq, notInArray} from 'drizzle-orm';
import {SyncWorkerDependencies} from '../dependencies';
import {guideLinkCheckTable} from './guide-link-table';

// Polite: the guide site is a handful of pages and this runs daily, so there
// is no reason to open thirty connections at once.
const CONCURRENCY = 4;
const TIMEOUT_MS = 20 * 1000;

type CheckResult = {
  equipmentId: string;
  url: string;
  status: number | null;
  reachable: boolean;
  checkedAt: Date;
};

const checkOne = async (
  equipmentId: string,
  url: string
): Promise<CheckResult> => {
  const checkedAt = new Date();
  try {
    // GET rather than HEAD: some hosts answer HEAD with 405 even for pages
    // that are perfectly real, which would report every link as broken.
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return {
      equipmentId,
      url,
      status: response.status,
      reachable: response.ok,
      checkedAt,
    };
  } catch {
    // No status at all: DNS failure, timeout, connection refused.
    return {equipmentId, url, status: null, reachable: false, checkedAt};
  }
};

export const checkGuideLinks = async (
  deps: Pick<SyncWorkerDependencies, 'sharedReadModel' | 'extDB' | 'logger'>
): Promise<void> => {
  const recorded = deps.sharedReadModel.equipment
    .getAllMinimal()
    .filter(item => O.isNone(item.removedAt))
    .flatMap(item =>
      O.isSome(item.guideUrl)
        ? [{equipmentId: item.id as string, url: item.guideUrl.value}]
        : []
    );

  // Forget machines whose address has since been cleared or retired, so a
  // stale "not reachable" cannot outlive the link it was about.
  if (recorded.length === 0) {
    await deps.extDB.delete(guideLinkCheckTable).run();
  } else {
    await deps.extDB
      .delete(guideLinkCheckTable)
      .where(
        notInArray(
          guideLinkCheckTable.equipmentId,
          recorded.map(item => item.equipmentId)
        )
      )
      .run();
  }

  for (let i = 0; i < recorded.length; i += CONCURRENCY) {
    const batch = await Promise.all(
      recorded
        .slice(i, i + CONCURRENCY)
        .map(item => checkOne(item.equipmentId, item.url))
    );
    for (const result of batch) {
      await deps.extDB
        .delete(guideLinkCheckTable)
        .where(eq(guideLinkCheckTable.equipmentId, result.equipmentId))
        .run();
      await deps.extDB.insert(guideLinkCheckTable).values(result).run();
    }
  }

  const broken = recorded.length;
  deps.logger.info(`Checked ${broken} equipment guide links`);
};
