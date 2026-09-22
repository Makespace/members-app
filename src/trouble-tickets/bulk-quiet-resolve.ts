import * as E from 'fp-ts/Either';
import {constructEvent} from '../types';
import {Dependencies} from '../dependencies';
import {TroubleTicket} from '../types/trouble-ticket';

type BulkQuietResolveDependencies = Pick<
  Dependencies,
  'sharedReadModel' | 'commitEvent' | 'logger'
>;

type BulkQuietResolveSummary = {
  // Tickets matching the filter that are not already resolved.
  candidates: number;
  resolved: number;
  failed: number;
  // A few titles, so a dry run is recognisable as the right set.
  sample: ReadonlyArray<{title: string; submittedAt: string; status: string}>;
};

// Open tickets submitted before the cutoff, oldest first.
const candidatesFor = (
  deps: BulkQuietResolveDependencies,
  before: Date
): ReadonlyArray<TroubleTicket> =>
  deps.sharedReadModel.troubleTickets
    .getAll()
    .filter(
      ticket =>
        ticket.status !== 'Resolved' && ticket.submittedAt.getTime() < before.getTime()
    )
    .slice()
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

const describe = (tickets: ReadonlyArray<TroubleTicket>) =>
  tickets.slice(0, 5).map(ticket => ({
    title: ticket.title,
    submittedAt: ticket.submittedAt.toISOString(),
    status: ticket.status,
  }));

// Closes a backlog of tickets that were dealt with long ago outside the app.
// Every resolve is quiet, so the notification sweep skips it entirely and no
// submitter is emailed. Already-resolved tickets are left alone, which makes
// a repeat run a no-op.
export const bulkQuietResolve =
  (deps: BulkQuietResolveDependencies) =>
  async (
    before: Date,
    options: {dryRun: boolean}
  ): Promise<BulkQuietResolveSummary> => {
    await deps.sharedReadModel.asyncRefresh()();
    const candidates = candidatesFor(deps, before);
    if (options.dryRun) {
      return {
        candidates: candidates.length,
        resolved: 0,
        failed: 0,
        sample: describe(candidates),
      };
    }

    let resolved = 0;
    let failed = 0;
    for (const ticket of candidates) {
      const result = await deps.commitEvent(
        deps.sharedReadModel.getCurrentEventIndex()
      )(
        constructEvent('TroubleTicketResolved')({
          ticketId: ticket.id,
          summary: '',
          quiet: true,
          actor: {tag: 'token', token: 'admin'},
        })
      )();
      if (E.isLeft(result)) {
        failed++;
        deps.logger.warn(
          'Bulk quiet resolve failed for ticket %s: %o',
          ticket.id,
          result.left
        );
        continue;
      }
      resolved++;
    }
    await deps.sharedReadModel.asyncRefresh()();
    deps.logger.info(
      'Bulk quiet resolve finished: %s resolved, %s failed',
      resolved,
      failed
    );
    return {
      candidates: candidates.length,
      resolved,
      failed,
      sample: describe(candidates),
    };
  };
