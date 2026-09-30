import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {FailureWithStatus} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {mustBeSuperuser} from '../util';
import {
  BillingConcern,
  getBillingOverview,
} from '../../read-models/external-state/billing-overview';
import {bandFor, OverdueBand, ViewModel} from './view-model';

const BANDS: ReadonlyArray<OverdueBand> = ['cancel', 'remove-access', 'watch'];

// Longest overdue first within a band: the person who has been waiting on us
// the longest is the one to deal with first.
const byDaysOverdue = (a: BillingConcern, b: BillingConcern) =>
  O.getOrElse(() => 0)(b.daysOverdue) - O.getOrElse(() => 0)(a.daysOverdue);

export const constructViewModel =
  (
    deps: Pick<Dependencies, 'sharedReadModel' | 'extDB' | 'conf'>,
    user: User
  ): TE.TaskEither<FailureWithStatus, ViewModel> =>
  async () => {
    const superUserCheck = await mustBeSuperuser(deps.sharedReadModel, user)();
    if (E.isLeft(superUserCheck)) {
      return superUserCheck;
    }

    const thresholds = {
      removeAccessAfterDays: deps.conf.BILLING_REMOVE_ACCESS_AFTER_DAYS,
      cancelAfterDays: deps.conf.BILLING_CANCEL_AFTER_DAYS,
    };

    const overview = await getBillingOverview(deps.extDB)(
      deps.sharedReadModel.members.getAllCore()
    );

    const overdue = overview.concerns.filter(c => c.kind === 'overdue');

    return E.right({
      bands: BANDS.map(band => ({
        band,
        concerns: overdue
          .filter(concern => bandFor(concern.daysOverdue, thresholds) === band)
          .sort(byDaysOverdue),
      })),
      pausedOwing: overview.concerns
        .filter(c => c.kind === 'paused-owing')
        .sort(byDaysOverdue),
      lapsed: overview.concerns.filter(c => c.kind === 'lapsed'),
      unlinked: [...overview.unlinked].sort(
        (a, b) =>
          O.getOrElse(() => 0)(b.daysOverdue) -
          O.getOrElse(() => 0)(a.daysOverdue)
      ),
      cachedAt: overview.cachedAt,
      isStale: overview.isStale,
      thresholds,
    });
  };
