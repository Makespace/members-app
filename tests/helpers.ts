import {error} from 'console';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {identity, pipe} from 'fp-ts/lib/function';
import {Actor, UserActor} from '../src/types/actor';
import {EmailAddress, EmailAddressCodec} from '../src/types/email-address';
import {ExternalStateDB} from '../src/sync-worker/external-state-db';
import {recurlySubscriptionTable} from '../src/sync-worker/recurly/recurly-data-table';
import * as betterSqlite3 from 'better-sqlite3';
import * as libsqlClient from '@libsql/client';

export const getRightOrFail = <A>(input: E.Either<unknown, A>): A =>
  pipe(
    input,
    E.getOrElseW(left => {
      error(left);
      throw new Error('unexpected Left');
    })
  );

export const getLeftOrFail = <E>(input: E.Either<E, unknown>): E =>
  pipe(
    input,
    E.match(identity, () => {
      throw new Error('unexpected Right');
    })
  );

export const getSomeOrFail = <A>(input: O.Option<A>): A =>
  pipe(
    input,
    O.getOrElseW(() => {
      throw new Error('unexpected None');
    })
  );

export const getTaskEitherRightOrFail = async <E, A>(
  input: TE.TaskEither<E, A>
): Promise<A> => getRightOrFail(await input());

export const arbitraryActor = (): Actor =>
  ({tag: 'token', token: 'admin'}) satisfies Actor;

export const tokenActor = arbitraryActor;

export const systemActor = (): Actor => ({tag: 'system'}) satisfies Actor;

export const userActor = (): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: getRightOrFail(EmailAddressCodec.decode('test@test.com')),
    memberNumber: 12,
  },
});

// Datetimes are truncated to integers in the database meaning they are truncated to the nearest second.
export const expectMatchSecondsPrecision = (expected: Date) => (actual: Date) =>
  expect(Math.floor(actual.getTime() / 1000)).toStrictEqual(
    Math.floor(expected.getTime() / 1000)
  );

export const insertRecurlySubscription = (
  extDB: ExternalStateDB,
  values: {
    email: EmailAddress;
    hasActiveSubscription: boolean;
    cacheLastUpdated?: Date;
    hasFutureSubscription?: boolean;
    hasCanceledSubscription?: boolean;
    hasPausedSubscription?: boolean;
    hasPastDueInvoice?: boolean;
    accountCode?: string;
  }
) =>
  extDB
    .insert(recurlySubscriptionTable)
    .values({
      cacheLastUpdated: new Date(),
      hasFutureSubscription: false,
      hasCanceledSubscription: false,
      hasPausedSubscription: false,
      hasPastDueInvoice: false,
      ...values,
    })
    .run();

// Statement-count helpers shared by the query-count tests (issue #414). They
// take narrow structural types so they can live here without importing the
// test framework.

// better-sqlite3's Database#prepare is the funnel every drizzle query passes
// through, so wrapping it counts shared-state statements issued while the
// action runs. The action is awaited before the counter is restored, so
// statements issued after an await inside the action are counted too.
export const countSharedStatements = async <A>(
  sharedReadModel: {_underlyingReadModelDb: betterSqlite3.Database},
  action: () => A | Promise<A>
): Promise<{result: A; queryCount: number}> => {
  let queryCount = 0;
  const db = sharedReadModel._underlyingReadModelDb;
  const originalPrepare = db.prepare.bind(db);
  db.prepare = ((...args: Parameters<typeof originalPrepare>) => {
    queryCount += 1;
    return originalPrepare(...args);
  }) as typeof db.prepare;
  try {
    const result = await action();
    return {result, queryCount};
  } finally {
    db.prepare = originalPrepare;
  }
};

// The recurly cache runs through the libsql client's execute funnel.
export const countExternalStatements = async <A>(
  extDBClient: libsqlClient.Client,
  action: () => Promise<A>
): Promise<{result: A; queryCount: number}> => {
  let queryCount = 0;
  const originalExecute = extDBClient.execute.bind(extDBClient);
  extDBClient.execute = ((...args: Parameters<typeof originalExecute>) => {
    queryCount += 1;
    return originalExecute(...args);
  }) as typeof extDBClient.execute;
  try {
    const result = await action();
    return {result, queryCount};
  } finally {
    extDBClient.execute = originalExecute;
  }
};
