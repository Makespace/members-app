import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {Dependencies} from '../dependencies';
import {Actor} from '../types';
import {applyImportPlan} from './apply-plan';
import {ImportPlan} from './plan-from-form';
import {ImportSummary} from './render-summary';

export type ImportJob = {
  startedAt: Date;
  startedBy: Actor;
  total: number;
  done: number;
  // Set once every row has been tried; until then the import is running.
  summary: O.Option<ImportSummary>;
};

// A confirmed import can be a couple of thousand events, each a round trip
// to the event store, which is longer than a request can stay open. So the
// confirm page starts the import and sends the admin to a status page that
// watches it. One at a time: a second confirm while one runs would race it
// on the same fobs. The job lives in memory, so a restart mid-import loses
// the status page but not the events already committed; re-uploading then
// shows what is left as "to record".
export type ImportRunner = {
  current: () => O.Option<ImportJob>;
  start: (
    deps: Dependencies,
    actor: Actor,
    plan: ImportPlan
  ) => E.Either<'already-running', ImportJob>;
};

export const createImportRunner = (): ImportRunner => {
  let job: ImportJob | undefined;
  return {
    current: () => O.fromNullable(job),
    start: (deps, actor, plan) => {
      if (job !== undefined && O.isNone(job.summary)) {
        return E.left('already-running');
      }
      const started: ImportJob = {
        startedAt: new Date(),
        startedBy: actor,
        total: plan.records.length + plan.removals.length,
        done: 0,
        summary: O.none,
      };
      job = started;
      void applyImportPlan(deps, actor, plan, done => {
        started.done = done;
      })
        .then(summary => {
          started.summary = O.some(summary);
        })
        .catch((error: unknown) => {
          deps.logger.error(error, 'Fob import stopped unexpectedly');
          started.summary = O.some({
            recorded: 0,
            removed: 0,
            skipped: plan.skipped,
            failures: [
              `The import stopped after ${started.done} of ${started.total} rows: ${
                error instanceof Error ? error.message : String(error)
              }. Upload the export again to see what is left.`,
            ],
          });
        });
      return E.right(started);
    },
  };
};
