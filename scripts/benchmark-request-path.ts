#!/usr/bin/env node
// Measures whole-request server-side work for the main logged-in pages by
// invoking the real queryGet handler (src/http/query-get.ts) with request and
// response doubles: session member load, viewer determination, page chrome
// (navbar, banners filtered by req.path, notifications), the query's view
// model and HTML rendering. Express routing, middleware and network transport
// are excluded - the handler is called directly, in-process, on a synthetic
// fixture. A response is counted only if the handler sent a 200 with a
// non-empty HTML document; a redirect or error fails the scenario.
//
// Usage:
//   npx tsx ./scripts/benchmark-request-path.ts
//
// Timings are printed per scenario alongside two separately counted statement
// totals: shared-state SQL (better-sqlite3, counted by wrapping prepare()) and
// external-cache SQL (the libsql recurly/sheet cache, counted by wrapping the
// client's execute()). The billing path is timed apart as well - retrieval and
// object construction via getBillingForMember, rendering via renderBilling -
// because those costs move independently of the page around them. Event
// replay into a fresh read model is measured more than once, since a single
// replay timing cannot distinguish noise from a real change. Run from the
// repo root.
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import createLogger from 'pino';
import * as libsqlClient from '@libsql/client';
import {UUID, NonEmptyString} from 'io-ts-types';
import {DateTime} from 'luxon';
import {Request, Response} from 'express';
import {initSharedReadModel, SharedReadModel} from '../src/read-models/shared-state';
import {
  ensureExtDBTablesExist,
  initExternalStateDB,
} from '../src/sync-worker/external-state-db';
import {
  recurlyInvoiceTable,
  recurlySubscriptionTable,
  recurlyTransactionTable,
} from '../src/sync-worker/recurly/recurly-data-table';
import {constructEvent, Actor, User, EmailAddress} from '../src/types';
import {EquipmentId} from '../src/types/equipment-id';
import {queryGet} from '../src/http/query-get';
import * as queries from '../src/queries';
import {Query} from '../src/queries/query';
import {Dependencies} from '../src/dependencies';
import {User as UserCodec} from '../src/types/user';
import {CompleteHtmlDocument} from '../src/types/html';
import {getBillingForMember} from '../src/read-models/external-state/recurly-billing';
import {renderBilling} from '../src/queries/member/render-billing';
import {constructViewModel as constructMemberViewModel} from '../src/queries/member/construct-view-model';

// The benchmark imports nothing from tests/, so this mirrors tests/helpers'
// arbitraryActor.
const arbitraryActor = (): Actor => ({tag: 'token', token: 'admin'});

type StoredEvent = Parameters<SharedReadModel['updateState']>[0];

const applyEvent = (rm: SharedReadModel) => {
  const recorded: StoredEvent[] = [];
  return {
    apply: (event: ReturnType<ReturnType<typeof constructEvent>>) => {
      const stored = {
        ...event,
        event_id: crypto.randomUUID(),
        event_index: rm.getCurrentEventIndex() + 1,
        deletedAt: null,
        deleteReason: null,
        markDeletedByMemberNumber: null,
      } as unknown as StoredEvent;
      recorded.push(stored);
      rm.updateState(stored);
    },
    events: () => recorded,
  };
};

// ---------------------------------------------------------------- fixture ---

const AREAS = 20;
const MACHINES_PER_AREA = 10;
const MEMBERS = 5000;
const TRAINING_RECORDS_PER_MEMBER = 2;
const TRAINERS_PER_MACHINE = 2;
const OWNERS_PER_AREA = 2;
const QUIZ_COMPLETIONS = 2000;
// One member with a long, partly unpaid history: every fifth invoice is still
// owed and the oldest of all is among them, so invoicesSinceFirstUnpaid keeps
// all of them and the page renders a card for each.
const TROUBLE_MEMBER_INVOICES = 400;
// A second long-history member who is square with us: as many invoices, none
// outstanding, so the summary selects nothing to render. The gap to the
// trouble member is the rendering cost of four hundred cards.
const ALL_PAID_MEMBER_INVOICES = 400;
// A member with a small, recent history, amid many invoices belonging to
// other members - this is what the invoice email index actually has to
// select from.
const SPARSE_MEMBER_INVOICES = 3;
const UNRELATED_INVOICE_MEMBERS = 200;
const INVOICES_PER_UNRELATED_MEMBER = 10;
const REPLAY_RUNS = 2;
const WARM_UPS = 3;
const MEASURED_RUNS = 10;

const now = DateTime.now();

// ------------------------------------------------------------- measuring ---

// Counts SQL statements on both databases the request path touches: the
// shared read model's better-sqlite3 database (prepare) and the external
// cache's libsql client (execute).
const timeWithCounting = async (
  fn: () => Promise<unknown>
): Promise<{ms: number; sharedStateStatements: number; externalStatements: number}> => {
  const db = rm._underlyingReadModelDb;
  const originalPrepare = db.prepare.bind(db);
  let sharedStateStatements = 0;
  db.prepare = ((...args: Parameters<typeof originalPrepare>) => {
    sharedStateStatements += 1;
    return originalPrepare(...args);
  }) as typeof db.prepare;

  const originalExecute = extDBClient.execute.bind(extDBClient);
  let externalStatements = 0;
  extDBClient.execute = ((...args: Parameters<typeof originalExecute>) => {
    externalStatements += 1;
    return originalExecute(...args);
  }) as typeof extDBClient.execute;

  const started = process.hrtime.bigint();
  try {
    await fn();
  } finally {
    db.prepare = originalPrepare;
    extDBClient.execute = originalExecute;
  }
  return {
    ms: Number(process.hrtime.bigint() - started) / 1_000_000,
    sharedStateStatements,
    externalStatements,
  };
};

// ------------------------------------------------------------- utilities ---

let rm: SharedReadModel;
let deps: Dependencies;
let extDBClient: libsqlClient.Client;

const measureScenario = async (
  label: string,
  fn: () => Promise<unknown>
): Promise<void> => {
  for (let i = 0; i < WARM_UPS; i += 1) {
    await timeWithCounting(fn);
  }
  const timings: number[] = [];
  let sharedStateStatements = 0;
  let externalStatements = 0;
  for (let i = 0; i < MEASURED_RUNS; i += 1) {
    const r = await timeWithCounting(fn);
    timings.push(r.ms);
    sharedStateStatements = r.sharedStateStatements;
    externalStatements = r.externalStatements;
  }
  timings.sort((a, b) => a - b);
  const median = timings[Math.floor(timings.length / 2)];
  console.log(
    `  ${label}\n` +
      `    median ${median.toFixed(2)} ms  (min ${timings[0].toFixed(2)}, max ${timings[timings.length - 1].toFixed(2)})` +
      ` over ${MEASURED_RUNS} runs after ${WARM_UPS} warm-ups` +
      `  |  ${sharedStateStatements} shared-state + ${externalStatements} external-cache SQL statements per request`
  );
};

const runQuery = async <A>(task: TE.TaskEither<unknown, A>): Promise<A> => {
  const result = await task();
  if (E.isLeft(result)) {
    throw new Error(`query failed: ${JSON.stringify(result.left)}`);
  }
  return result.right;
};

const asUser = (memberNumber: number, email: string): User => {
  const decoded = UserCodec.decode({emailAddress: email, memberNumber});
  if (E.isLeft(decoded)) {
    throw new Error('bad user fixture');
  }
  return decoded.right;
};

// Request/response doubles for queryGet: a session with a logged-in user, and
// a response that records what the handler sent. Any outcome other than a 200
// carrying a non-empty HTML document fails the scenario, so a future change
// to the handler's contract cannot silently pass as a fast blank response.
const requestDouble = (
  user: User,
  params: Record<string, string>,
  path: string
): Request =>
  ({
    session: {passport: {user}},
    params,
    query: {},
    path,
  }) as unknown as Request;

const responseDouble = (): Response<CompleteHtmlDocument> & {
  sentBody: unknown;
  sentStatus: number | undefined;
  redirectedTo: string | undefined;
} => {
  const res = {
    sentBody: undefined as unknown,
    sentStatus: undefined as number | undefined,
    redirectedTo: undefined as string | undefined,
    status(code: number) {
      this.sentStatus = code;
      return this;
    },
    send(body: unknown) {
      this.sentBody = body;
      return this;
    },
    redirect(url: string) {
      this.redirectedTo = url;
      return this;
    },
    setHeader() {
      return this;
    },
  };
  return res as never;
};

const assertServed = (
  label: string,
  res: ReturnType<typeof responseDouble>
): void => {
  if (res.redirectedTo !== undefined) {
    throw new Error(`${label}: handler redirected to ${res.redirectedTo}`);
  }
  if (res.sentStatus !== 200) {
    throw new Error(`${label}: handler responded ${String(res.sentStatus)}`);
  }
  if (typeof res.sentBody !== 'string' || res.sentBody.length === 0) {
    throw new Error(`${label}: handler sent no HTML body`);
  }
};

// One full request through the real handler: session load, viewer, chrome,
// query, rendering. Express routing and network transport are excluded.
const servePage = async (
  deps: Dependencies,
  query: Query,
  user: User,
  params: Record<string, string> = {},
  path = '/'
): Promise<unknown> => {
  const res = responseDouble();
  await queryGet(deps, query)(requestDouble(user, params, path), res);
  assertServed(query.name ?? 'query', res);
  return res.sentBody;
};

const run = async () => {
  const logger = createLogger({level: 'silent'});
  const eventDB = libsqlClient.createClient({url: ':memory:'});
  extDBClient = libsqlClient.createClient({url: ':memory:'});
  const extDB = initExternalStateDB(extDBClient);
  await ensureExtDBTablesExist(extDB)();
  rm = initSharedReadModel(eventDB, logger);
  const {apply, events} = applyEvent(rm);

  deps = {
    conf: {
      PUBLIC_URL: 'http://localhost:8080',
      GMAIL_IMPORT_MAILBOX: '',
      MANAGEMENT_TEAM_AREA_ID: '',
    },
    sharedReadModel: rm,
    extDB,
    logger,
    rateLimitSendingOfEmails: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    sendEmail: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    lastQuizSync: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    getSheetData: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    getSheetDataByMemberNumber: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    commitEvent: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    getAllEvents: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    getDeletedEvents: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    getAllEventsByType: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    getEventByIndex: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    getDeletedEventByIndex: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    deleteEvent: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    unDeleteEvent: (() => {
      throw new Error('not used by benchmark');
    }) as never,
    rebuildEventTimeline: (() => {
      throw new Error('not used by benchmark');
    }) as never,
  } as unknown as Dependencies;

  console.log(
    `Node ${process.version}; measuring the real queryGet handler in-process (Express routing and transport excluded)`
  );

  // --- fixture: areas, machines, members, training, ownership, quizzes -----
  const machineIds: EquipmentId[] = [];
  const areaIds: UUID[] = [];
  for (let a = 0; a < AREAS; a += 1) {
    const areaId = crypto.randomUUID() as UUID;
    areaIds.push(areaId);
    apply(constructEvent('AreaCreated')({id: areaId, name: `Area ${a}`, actor: arbitraryActor()}));
    for (let m = 0; m < MACHINES_PER_AREA; m += 1) {
      const equipmentId = crypto.randomUUID() as EquipmentId;
      machineIds.push(equipmentId);
      apply(constructEvent('EquipmentAdded')({
        id: equipmentId,
        name: `Machine ${a}-${m}` as NonEmptyString,
        areaId,
        category: 'red',
        actor: arbitraryActor(),
      }));
      apply(constructEvent('EquipmentTrainingSheetRegistered')({
        equipmentId,
        trainingSheetId: `sheet-${equipmentId}`,
        actor: arbitraryActor(),
      }));
    }
  }

  const linkMember = (memberNumber: number, email: string, name: string) => {
    apply(constructEvent('MemberNumberLinkedToEmail')({
      memberNumber,
      email: email as EmailAddress,
      name,
      formOfAddress: undefined,
      actor: arbitraryActor(),
    }));
    // MemberNumberLinkedToEmail already records the address as verified (see
    // update-state's insertMemberEmail with recordedAt as verifiedAt); this
    // event is what real signups also replay, and is harmless here.
    apply(constructEvent('MemberEmailVerified')({
      memberNumber,
      email: email as EmailAddress,
      actor: arbitraryActor(),
    }));
  };

  let nextMemberNumber = 10000;
  const newMember = (name: string): number => {
    const memberNumber = nextMemberNumber;
    nextMemberNumber += 1;
    linkMember(memberNumber, `member${memberNumber}@example.com`, name);
    return memberNumber;
  };

  for (let i = 0; i < MEMBERS; i += 1) {
    const memberNumber = newMember(`Member ${i}`);
    for (let t = 0; t < TRAINING_RECORDS_PER_MEMBER; t += 1) {
      apply(constructEvent('MemberTrainedOnEquipmentBy')({
        equipmentId: machineIds[(i * TRAINING_RECORDS_PER_MEMBER + t) % machineIds.length],
        memberNumber,
        trainedByMemberNumber: memberNumber,
        trainedAt: now.minus({days: 30}).toJSDate(),
        markedTrainedBy: memberNumber,
        actor: arbitraryActor(),
      }));
    }
  }

  // A couple of trainers per machine, so equipment expansion walks a realistic
  // trainers table too.
  for (let i = 0; i < machineIds.length; i += 1) {
    for (let t = 0; t < TRAINERS_PER_MACHINE; t += 1) {
      apply(constructEvent('TrainerAdded')({
        equipmentId: machineIds[i],
        memberNumber: 10000 + ((i * TRAINERS_PER_MACHINE + t) % MEMBERS),
        actor: arbitraryActor(),
      }));
    }
  }

  for (const areaId of areaIds) {
    for (let o = 0; o < OWNERS_PER_AREA; o += 1) {
      apply(constructEvent('OwnerAdded')({
        areaId,
        memberNumber: newMember(`Owner ${areaId}-${o}`),
        actor: arbitraryActor(),
      }));
    }
  }

  for (let i = 0; i < QUIZ_COMPLETIONS; i += 1) {
    apply(constructEvent('TrainingQuizCompleted')({
      trainingSheetId: `sheet-${machineIds[i % machineIds.length]}`,
      completedAt: now.minus({days: i % 400}).toJSDate(),
      memberNumberProvided: 10000 + (i % 100),
      emailProvided: null,
      score: 5,
      maxScore: 5,
      rowHash: `hash-${i}`,
      actor: arbitraryActor(),
    }));
  }

  const ordinaryMember = newMember('Ordinary Viewer');
  const superUserNumber = newMember('Super User');
  apply(constructEvent('SuperUserDeclared')({memberNumber: superUserNumber, actor: arbitraryActor()}));
  const areaOwner = newMember('Area Owner Viewer');
  apply(constructEvent('OwnerAdded')({areaId: areaIds[0], memberNumber: areaOwner, actor: arbitraryActor()}));

  const troubleMember = newMember('Long Unpaid History Member');
  const allPaidMember = newMember('Long Paid History Member');
  const sparseMember = newMember('Small Recent History Member');

  // Invoices all belong to the recurly cache, keyed by email - members whose
  // invoices we never follow need no member-number events at all.
  let nextInvoiceNumber = 1000;
  const insertInvoice = async (
    id: string,
    email: string,
    state: 'paid' | 'past_due',
    over: {createdAt?: Date; dueAt?: Date} = {}
  ) => {
    const paid = state !== 'past_due';
    await extDB.insert(recurlyInvoiceTable).values({
      id,
      email,
      accountId: `acct_${email}`,
      number: String(nextInvoiceNumber += 1),
      state,
      collectionMethod: 'automatic',
      currency: 'GBP',
      total: 25,
      paid: paid ? 25 : 0,
      balance: paid ? 0 : 25,
      createdAt: over.createdAt ?? now.minus({days: 400}).toJSDate(),
      dueAt: over.dueAt ?? now.minus({days: 370}).toJSDate(),
      cachedAt: new Date(),
    }).run();
  };

  for (let i = 0; i < TROUBLE_MEMBER_INVOICES; i += 1) {
    const unpaid = i % 5 === 0; // every fifth invoice is still outstanding
    await insertInvoice(`inv_trouble_${i}`, `member${troubleMember}@example.com`, unpaid ? 'past_due' : 'paid', {
      createdAt: now.minus({days: 400 - i}).toJSDate(),
      dueAt: now.minus({days: 370 - i}).toJSDate(),
    });
    if (unpaid) {
      await extDB.insert(recurlyTransactionTable).values({
        id: `tx_trouble_${i}`,
        invoiceId: `inv_trouble_${i}`,
        email: null,
        status: 'declined',
        success: false,
        customerMessage: 'Insufficient funds.',
        createdAt: now.minus({days: 370 - i}).toJSDate(),
        cachedAt: new Date(),
      }).run();
    }
  }

  for (let i = 0; i < ALL_PAID_MEMBER_INVOICES; i += 1) {
    await insertInvoice(`inv_paid_${i}`, `member${allPaidMember}@example.com`, 'paid', {
      createdAt: now.minus({days: 400 - i}).toJSDate(),
      dueAt: now.minus({days: 370 - i}).toJSDate(),
    });
  }

  for (let i = 0; i < SPARSE_MEMBER_INVOICES - 1; i += 1) {
    await insertInvoice(`inv_sparse_${i}`, `member${sparseMember}@example.com`, 'paid', {
      createdAt: now.minus({days: 40 - i}).toJSDate(),
      dueAt: now.minus({days: 10 - i}).toJSDate(),
    });
  }
  // The most recent one failed - the shape a chaser actually opens.
  await insertInvoice('inv_sparse_latest', `member${sparseMember}@example.com`, 'past_due', {
    createdAt: now.minus({days: 5}).toJSDate(),
    dueAt: now.minus({days: 2}).toJSDate(),
  });
  await extDB.insert(recurlyTransactionTable).values({
    id: 'tx_sparse_latest',
    invoiceId: 'inv_sparse_latest',
    email: null,
    status: 'declined',
    success: false,
    customerMessage: 'Insufficient funds.',
    createdAt: now.minus({days: 2}).toJSDate(),
    cachedAt: new Date(),
  }).run();

  for (let m = 0; m < UNRELATED_INVOICE_MEMBERS; m += 1) {
    for (let i = 0; i < INVOICES_PER_UNRELATED_MEMBER; i += 1) {
      await insertInvoice(
        `inv_unrelated_${m}_${i}`,
        `unrelated${m}@example.com`,
        'paid'
      );
    }
  }

  // Fresh subscription rows for every member so recurly lookups do real work.
  const totalMembers = nextMemberNumber - 10000;
  for (let i = 0; i < totalMembers; i += 1) {
    await extDB.insert(recurlySubscriptionTable).values({
      email: `member${10000 + i}@example.com`,
      cacheLastUpdated: new Date(),
      hasActiveSubscription: i % 4 !== 0,
      hasFutureSubscription: false,
      hasCanceledSubscription: false,
      hasPausedSubscription: false,
      hasPastDueInvoice: false,
    }).run();
  }

  const ordinaryUser = asUser(ordinaryMember, `member${ordinaryMember}@example.com`);
  const superUser = asUser(superUserNumber, `member${superUserNumber}@example.com`);
  const ownerUser = asUser(areaOwner, `member${areaOwner}@example.com`);
  const otherMember = 10000; // first seeded member, no relationship to viewer

  console.log(
    `Fixture: ${AREAS} areas, ${machineIds.length} machines, ${totalMembers} members, ` +
      `${MEMBERS * TRAINING_RECORDS_PER_MEMBER} training records, ${machineIds.length * TRAINERS_PER_MACHINE} trainer rows, ` +
      `${QUIZ_COMPLETIONS} quiz completions, ` +
      `${TROUBLE_MEMBER_INVOICES} invoices on the trouble member (oldest unpaid, all rendered), ` +
      `${ALL_PAID_MEMBER_INVOICES} all-paid invoices, ${SPARSE_MEMBER_INVOICES} on the sparse member, ` +
      `${UNRELATED_INVOICE_MEMBERS * INVOICES_PER_UNRELATED_MEMBER} unrelated invoices, ${totalMembers} subscription rows`
  );

  // Replay cost: how long a fresh read model takes to project the same event
  // stream from scratch. Indexed columns must not slow this down materially.
  // Measured more than once: a single replay timing cannot separate noise
  // from a real change, so compare run-to-run spread, not a single figure.
  for (let r = 0; r < REPLAY_RUNS; r += 1) {
    const replayStarted = process.hrtime.bigint();
    const eventDB2 = libsqlClient.createClient({url: ':memory:'});
    const rm2 = initSharedReadModel(eventDB2, logger);
    for (const stored of events()) {
      rm2.updateState(stored);
    }
    const replayMs = Number(process.hrtime.bigint() - replayStarted) / 1_000_000;
    console.log(
      `Event replay into a fresh read model (run ${r + 1} of ${REPLAY_RUNS}): ` +
        `${replayMs.toFixed(0)} ms for ${rm2.getCurrentEventIndex()} events`
    );
    eventDB2.close();
  }

  // EXPLAIN QUERY PLAN for the access paths the pages use, in the shapes the
  // production code issues them, on this populated fixture's actual schemas -
  // shared-state and external-cache alike.
  {
    const db = rm._underlyingReadModelDb;
    const plans: Array<[string, string]> = [];
    const explain = (label: string, sqlText: string, params: unknown[] = []) => {
      const rows = db.prepare(`EXPLAIN QUERY PLAN ${sqlText}`).all(...params) as Array<{detail: string}>;
      plans.push([label, rows.map(r => r.detail).join('; ')]);
    };
    explain(
      'member numbers by user (desc)',
      'SELECT memberNumber FROM memberNumbers WHERE userId = ? ORDER BY memberNumber DESC',
      ['u1']
    );
    explain(
      'member emails by user (desc addedAt)',
      'SELECT * FROM memberEmails WHERE userId = ? ORDER BY addedAt DESC',
      ['u1']
    );
    explain(
      'trained members by user (join equipment)',
      'SELECT trainedMembers.equipmentId, equipment.name, trainedMembers.trainedAt FROM trainedMembers INNER JOIN equipment ON equipment.id = trainedMembers.equipmentId WHERE trainedMembers.userId = ?',
      ['u1']
    );
    explain(
      'trainer-for by user (join equipment)',
      'SELECT trainers.equipmentId, equipment.name, trainers.since FROM trainers LEFT JOIN equipment ON equipment.id = trainers.equipmentId WHERE trainers.userId = ?',
      ['u1']
    );
    explain(
      'owner-of by user (join areas)',
      'SELECT owners.areaId, areas.name, owners.ownershipRecordedAt FROM owners LEFT JOIN areas ON areas.id = owners.areaId WHERE owners.userId = ?',
      ['u1']
    );
    explain(
      'owners of an area',
      'SELECT * FROM owners WHERE areaId = ?',
      [areaIds[0]]
    );
    explain(
      'equipment by area',
      'SELECT * FROM equipment WHERE areaId = ?',
      [areaIds[0]]
    );
    explain(
      'trained members by equipment (ordered)',
      'SELECT * FROM trainedMembers WHERE equipmentId = ? ORDER BY trainedAt',
      [machineIds[0]]
    );
    explain(
      'trainers by equipment',
      'SELECT trainers.userId, trainers.since FROM trainers WHERE trainers.equipmentId = ?',
      [machineIds[0]]
    );
    // As trainingsDeliveredBy issues it: an equipment-id list, not a subquery.
    explain(
      'trainings delivered by trainer numbers on listed equipment',
      `SELECT trainedAt FROM trainedMembers WHERE trainedByMemberNumber IN (${['?', '?'].join(',')}) AND equipmentId IN (${machineIds
        .slice(0, MACHINES_PER_AREA)
        .map(() => '?')
        .join(',')}) AND legacyImport = 0`,
      [10001, 10002, ...machineIds.slice(0, MACHINES_PER_AREA)]
    );
    console.log('\nQuery plans on the populated fixture (shared-state db):');
    for (const [label, plan] of plans) {
      console.log(`  ${label}\n    ${plan}`);
    }
  }
  {
    const plans: Array<[string, string]> = [];
    const explain = async (label: string, sqlText: string, args: unknown[] = []) => {
      const rs = await extDBClient.execute({
        sql: `EXPLAIN QUERY PLAN ${sqlText}`,
        args: args as never,
      });
      plans.push([
        label,
        rs.rows.map(r => JSON.stringify(r.detail)).join('; '),
      ]);
    };
    // As getRecurlyStatusForMember / _getRecurlyFlags issue it: the cache
    // stores cacheLastUpdated as integer milliseconds, and so does the bound
    // parameter.
    await explain(
      'recurly subscriptions by lower(email), fresh rows',
      'SELECT hasActiveSubscription FROM recurly_subscriptions WHERE lower(email) IN (?) AND cacheLastUpdated > ?',
      [`member${ordinaryMember}@example.com`, now.minus({days: 3}).toJSDate().getTime()]
    );
    // As getBillingForMember issues it.
    await explain(
      'recurly invoices by lower(email)',
      'SELECT * FROM recurly_invoices WHERE lower(email) IN (?)',
      [`member${troubleMember}@example.com`]
    );
    await explain(
      'recurly transactions by listed invoice ids',
      `SELECT * FROM recurly_transactions WHERE invoiceId IN (?, ?, ?)`,
      ['inv_trouble_0', 'inv_trouble_1', 'inv_trouble_2']
    );
    console.log('\nQuery plans on the populated fixture (external-cache db):');
    for (const [label, plan] of plans) {
      console.log(`  ${label}\n    ${plan}`);
    }
  }

  // Billing, taken apart: getBillingForMember is retrieval plus object
  // construction; renderBilling is the card markup. A page scenario combines
  // both with the rest of the request, so the difference locates where a
  // change would pay off. The trouble member renders every invoice card; the
  // all-paid member renders none of four hundred; the sparse member shows
  // what a lookup costs when the cache holds thousands of other members'
  // invoices too. These three members are one shape of billing history, not
  // a survey of every member - the page scenarios above are where the whole
  // request is measured.
  {
    const billingCases: Array<[string, number]> = [
      ['trouble member (400 invoices, oldest unpaid)', troubleMember],
      ['all-paid member (400 invoices, none outstanding)', allPaidMember],
      ['sparse member (3 invoices among thousands of unrelated)', sparseMember],
    ];
    console.log('\nBilling retrieval vs rendering (super-user view):');
    for (const [label, memberNumber] of billingCases) {
      const viewModel = await runQuery(
        constructMemberViewModel(deps, superUser)(memberNumber)
      );
      await measureScenario(`${label} - getBillingForMember`, () =>
        getBillingForMember(deps.extDB)(viewModel.member)
      );
      await measureScenario(`${label} - renderBilling`, async () =>
        renderBilling(viewModel)
      );
    }
  }

  // Sanity: every scenario must succeed before we trust its timings.
  await servePage(deps, queries.me, ordinaryUser);
  await servePage(deps, queries.member, ordinaryUser, {member: String(otherMember)}, `/member/${otherMember}`);
  await servePage(deps, queries.member, superUser, {member: String(troubleMember)}, `/member/${troubleMember}`);
  await servePage(deps, queries.member, superUser, {member: String(allPaidMember)}, `/member/${allPaidMember}`);
  await servePage(deps, queries.member, superUser, {member: String(sparseMember)}, `/member/${sparseMember}`);
  await servePage(deps, queries.areas, ordinaryUser, {}, '/areas');
  await servePage(deps, queries.areas, ownerUser, {}, '/areas');
  await servePage(deps, queries.areas, superUser, {}, '/areas');
  console.log('All scenarios ran cleanly once; measuring.');

  await measureScenario('/ (homepage, ordinary member)', () =>
    servePage(deps, queries.me, ordinaryUser)
  );
  await measureScenario('/member/:member (self)', () =>
    servePage(deps, queries.member, ordinaryUser, {member: String(ordinaryMember)}, `/member/${ordinaryMember}`)
  );
  await measureScenario('/member/:member (other member, ordinary viewer)', () =>
    servePage(deps, queries.member, ordinaryUser, {member: String(otherMember)}, `/member/${otherMember}`)
  );
  await measureScenario('/member/:member (super-user viewing trouble member: 400 invoices, all rendered)', () =>
    servePage(deps, queries.member, superUser, {member: String(troubleMember)}, `/member/${troubleMember}`)
  );
  await measureScenario('/member/:member (super-user viewing all-paid member: 400 invoices, none rendered)', () =>
    servePage(deps, queries.member, superUser, {member: String(allPaidMember)}, `/member/${allPaidMember}`)
  );
  await measureScenario('/member/:member (super-user viewing sparse member: 3 invoices amid thousands)', () =>
    servePage(deps, queries.member, superUser, {member: String(sparseMember)}, `/member/${sparseMember}`)
  );
  await measureScenario('/areas (ordinary member)', () =>
    servePage(deps, queries.areas, ordinaryUser, {}, '/areas')
  );
  await measureScenario('/areas (area owner)', () =>
    servePage(deps, queries.areas, ownerUser, {}, '/areas')
  );
  await measureScenario('/areas (super-user)', () =>
    servePage(deps, queries.areas, superUser, {}, '/areas')
  );
};

run().catch(e => {
  console.error(e);
  process.exit(1);
});
