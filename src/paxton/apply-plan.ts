import * as E from 'fp-ts/Either';
import {Dependencies} from '../dependencies';
import {commands} from '../commands';
import {applyCommand} from '../commands/apply-command';
import {Actor} from '../types';
import {ImportPlan} from './plan-from-form';
import {ImportSummary} from './render-summary';

// Applies a confirmed preview one command at a time. Each row goes through
// the same record-fob / remove-fob commands as the member page, so the import
// can record nothing those forms would refuse; a row that fails is reported
// and the rest continue. Sequential on purpose: every commit refreshes the
// read model, which the next command's checks rely on.
export const applyImportPlan = async (
  deps: Dependencies,
  actor: Actor,
  plan: ImportPlan
): Promise<ImportSummary> => {
  let recorded = 0;
  let removed = 0;
  const failures: string[] = [];

  for (const record of plan.records) {
    const label = `Fob ${record.fobId} (${record.paxtonName})`;
    const input = commands.members.recordFob.decode(record);
    if (E.isLeft(input)) {
      failures.push(`${label}: member number "${record.memberNumber}" is not valid`);
      continue;
    }
    const result = await applyCommand(deps, commands.members.recordFob)(
      input.right,
      actor
    )();
    if (E.isLeft(result)) {
      failures.push(`${label} for member ${record.memberNumber}: ${result.left.message}`);
      deps.logger.warn(result.left, 'Fob import: record failed');
      continue;
    }
    recorded += 1;
  }

  for (const removal of plan.removals) {
    const input = commands.members.removeFob.decode(removal);
    if (E.isLeft(input)) {
      failures.push(`Fob ${removal.fobId}: removal was not valid`);
      continue;
    }
    const result = await applyCommand(deps, commands.members.removeFob)(
      input.right,
      actor
    )();
    if (E.isLeft(result)) {
      failures.push(`Fob ${removal.fobId} for member ${removal.memberNumber}: ${result.left.message}`);
      deps.logger.warn(result.left, 'Fob import: removal failed');
      continue;
    }
    removed += 1;
  }

  const summary = {recorded, removed, skipped: plan.skipped, failures};
  deps.logger.info(summary, 'Fob import applied');
  return summary;
};
