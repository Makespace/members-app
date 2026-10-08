import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {FailureWithStatus} from '../../types/failure-with-status';
import {User} from '../../types/user';
import * as O from 'fp-ts/Option';
import {UnlinkedRecurlyEntry, ViewModel, needsAction} from './view-model';
import {SharedReadModel} from '../../read-models/shared-state';
import {mustBeSuperuser} from '../util';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {recurlySubscriptionTable} from '../../sync-worker/recurly/recurly-data-table';
import {memberEmailsTable} from '../../read-models/shared-state/state';

export const constructViewModel =
  (sharedReadModel: SharedReadModel, extDB: ExternalStateDB) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
  async () => {
    const superUserCheck = await mustBeSuperuser(sharedReadModel, user)();
    if (E.isLeft(superUserCheck)) {
      return superUserCheck;
    }

    const recurlyEmails = await extDB
      .select()
      .from(recurlySubscriptionTable)
      .all();

    const memberEmails = new Set(
      sharedReadModel.readOnlyDb
        .select({emailAddress: memberEmailsTable.emailAddress})
        .from(memberEmailsTable)
        .all()
        .map(row => row.emailAddress.toLowerCase())
    );

    // Linked by billing email or by account code, as every Recurly lookup is.
    const unlinkedEmails = recurlyEmails.filter(
      entry =>
        !memberEmails.has(entry.email.toLowerCase()) &&
        !(entry.accountCode !== null && memberEmails.has(entry.accountCode))
    );

    const entries: ReadonlyArray<UnlinkedRecurlyEntry> = unlinkedEmails.map(
      entry => ({
        email: entry.email,
        accountCode: O.fromNullable(entry.accountCode),
        hasActiveSubscription: entry.hasActiveSubscription,
        hasFutureSubscription: entry.hasFutureSubscription,
        hasCanceledSubscription: entry.hasCanceledSubscription,
        hasPausedSubscription: entry.hasPausedSubscription,
        hasPastDueInvoice: entry.hasPastDueInvoice,
        cacheLastUpdated: entry.cacheLastUpdated,
      })
    );
    return E.right({
      needingAction: entries.filter(needsAction),
      theRest: entries.filter(entry => !needsAction(entry)),
    });
  };
