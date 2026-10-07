import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {FailureWithStatus} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {mustBeSuperuser} from '../util';
import {getRecurlyReasonsForMember} from '../../read-models/external-state/recurly-status';
import {
  BillingConcern,
  getBillingOverview,
} from '../../read-models/external-state/billing-overview';
import {AuditRow, entitlementOf, fobAccessOfMember, groupRows} from './classify';
import {ViewModel} from './view-model';

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
    const members = deps.sharedReadModel.members.getAllCore();

    // The overdue picture comes in a handful of queries for everyone; the
    // subscription flags are one query per member, as on /members.
    const overview = await getBillingOverview(deps.extDB)(members);
    const concernByMember = new Map<number, BillingConcern>();
    for (const concern of overview.concerns) {
      if (concern.kind === 'overdue') {
        concernByMember.set(concern.memberNumber, concern);
      }
    }

    const rows: AuditRow[] = await Promise.all(
      members.map(async member => ({
        member,
        fobAccess: fobAccessOfMember(member),
        entitlement: entitlementOf(
          await getRecurlyReasonsForMember(deps.extDB)(member),
          O.fromNullable(concernByMember.get(member.memberNumber)),
          thresholds
        ),
      }))
    );

    return E.right({
      groups: groupRows(rows),
      totalMembers: members.length,
      membersWithFobs: members.filter(member => member.fobs.length > 0).length,
      thresholds,
    });
  };
