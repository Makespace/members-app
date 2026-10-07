import * as E from 'fp-ts/Either';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../dependencies';
import {Command, commands} from '../commands';
import {applyCommand} from '../commands/apply-command';
import {Actor} from '../types';
import {FailureWithStatus} from '../types/failure-with-status';
import {ImportPlan} from './plan-from-form';
import {ImportSummary} from './render-summary';

// Each commit is checked against the read model's last event index, and the
// sync worker commits events of its own, so over a long import one of its
// events can land between a row's check and its commit. The refresh that
// follows every commit brings the index up to date, so one retry is enough.
const applyWithRetry = async <T>(
  deps: Dependencies,
  command: Command<T>,
  input: T,
  actor: Actor
): Promise<E.Either<FailureWithStatus, unknown>> => {
  const first = await applyCommand(deps, command)(input, actor)();
  if (
    E.isLeft(first) &&
    first.left.status === StatusCodes.BAD_REQUEST &&
    first.left.message.startsWith('Resource has changes')
  ) {
    return applyCommand(deps, command)(input, actor)();
  }
  return first;
};

// Applies a confirmed preview one command at a time. Each row goes through
// the same record-fob / remove-fob commands as the member page, so the import
// can record nothing those forms would refuse; a row that fails is reported
// and the rest continue. Sequential on purpose: every commit refreshes the
// read model, which the next command's checks rely on. |onProgress| is told
// after each row so a status page can show how far along a long import is.
export const applyImportPlan = async (
  deps: Dependencies,
  actor: Actor,
  plan: ImportPlan,
  onProgress: (done: number) => void = () => {}
): Promise<ImportSummary> => {
  let recorded = 0;
  let removed = 0;
  let done = 0;
  const failures: string[] = [];

  for (const record of plan.records) {
    const label = `Fob ${record.fobId} (${record.paxtonName})`;
    const input = commands.members.recordFob.decode(record);
    if (E.isLeft(input)) {
      failures.push(`${label}: member number "${record.memberNumber}" is not valid`);
    } else {
      const result = await applyWithRetry(
        deps,
        commands.members.recordFob,
        input.right,
        actor
      );
      if (E.isLeft(result)) {
        failures.push(`${label} for member ${record.memberNumber}: ${result.left.message}`);
        deps.logger.warn(result.left, 'Fob import: record failed');
      } else {
        recorded += 1;
      }
    }
    onProgress(++done);
  }

  for (const removal of plan.removals) {
    const input = commands.members.removeFob.decode(removal);
    if (E.isLeft(input)) {
      failures.push(`Fob ${removal.fobId}: removal was not valid`);
    } else {
      const result = await applyWithRetry(
        deps,
        commands.members.removeFob,
        input.right,
        actor
      );
      if (E.isLeft(result)) {
        failures.push(`Fob ${removal.fobId} for member ${removal.memberNumber}: ${result.left.message}`);
        deps.logger.warn(result.left, 'Fob import: removal failed');
      } else {
        removed += 1;
      }
    }
    onProgress(++done);
  }

  const summary = {recorded, removed, skipped: plan.skipped, failures};
  deps.logger.info(summary, 'Fob import applied');
  return summary;
};
