import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';
import {isNotNull} from 'drizzle-orm';
import {DateTime} from 'luxon';
import {FailureWithStatus} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {UnlinkedRecurlyEntry, ViewModel, needsAction} from './view-model';
import {SharedReadModel} from '../../read-models/shared-state';
import {mustBeSuperuser} from '../util';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {
  recurlyAccountCodeTable,
  recurlySubscriptionTable,
} from '../../sync-worker/recurly/recurly-data-table';
import {memberEmailsTable} from '../../read-models/shared-state/state';
import {RECURLY_TTL} from '../../read-models/external-state/recurly-status';

export const constructViewModel =
  (sharedReadModel: SharedReadModel, extDB: ExternalStateDB) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
  async () => {
    const superUserCheck = await mustBeSuperuser(sharedReadModel, user)();
    if (E.isLeft(superUserCheck)) {
      return superUserCheck;
    }

    const accounts = await extDB.select().from(recurlySubscriptionTable).all();
    const codes = await extDB.select().from(recurlyAccountCodeTable).all();

    // Verified only, as every Recurly lookup is: an address added but not
    // yet verified links nothing, so it must not make a row disappear here.
    const memberEmails = new Set(
      sharedReadModel.readOnlyDb
        .select({emailAddress: memberEmailsTable.emailAddress})
        .from(memberEmailsTable)
        .where(isNotNull(memberEmailsTable.verifiedAt))
        .all()
        .map(row => row.emailAddress.toLowerCase())
    );

    const codesByEmail = new Map<string, string[]>();
    for (const row of codes) {
      const key = row.email.toLowerCase();
      codesByEmail.set(key, [...(codesByEmail.get(key) ?? []), row.code]);
    }

    // Linked by billing email or by account code, as every Recurly lookup is.
    const isLinked = (email: string) =>
      memberEmails.has(email) ||
      (codesByEmail.get(email) ?? []).some(code => memberEmails.has(code));

    const freshAfter = DateTime.now().minus(RECURLY_TTL).toJSDate();
    const entries: ReadonlyArray<UnlinkedRecurlyEntry> = accounts
      .filter(account => !isLinked(account.email.toLowerCase()))
      .map(account => {
        const email = account.email.toLowerCase();
        return {
          email: account.email,
          otherCodes: (codesByEmail.get(email) ?? []).filter(
            code => code !== email
          ),
          hasActiveSubscription: account.hasActiveSubscription,
          hasFutureSubscription: account.hasFutureSubscription,
          hasCanceledSubscription: account.hasCanceledSubscription,
          hasPausedSubscription: account.hasPausedSubscription,
          hasPastDueInvoice: account.hasPastDueInvoice,
          cacheLastUpdated: account.cacheLastUpdated,
          isFresh: account.cacheLastUpdated > freshAfter,
        };
      });

    const {left: theRest, right: needingAction} = RA.partition(needsAction)(entries);
    return E.right({needingAction, theRest});
  };
