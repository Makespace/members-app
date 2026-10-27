// THE ONLY WAY THIS APP MAY CHANGE ANYTHING IN RECURLY.
//
// Recurly holds members' subscriptions and cards, so a write there moves real
// money or ends a real membership. Every write to Recurly - from app code,
// the sync worker, or a script - goes through this gateway, and nothing else
// in the repo may construct a Recurly client that writes. The read-only sync
// (sync-worker/recurly/pull-recurly-data.ts) keeps its own client on the
// read-only RECURLY_TOKEN and may only call list*/get* methods.
//
// This is enforced, not just asked for:
// - tests/recurly-write/recurly-write-boundary.test.ts fails if the recurly
//   package is imported anywhere else, or a Recurly write method is called
//   outside this directory.
// - eslint.config.js restricts importing 'recurly' to the same files.
// - .github/workflows/recurly-write-flag.yml labels and comments on any pull
//   request that changes this directory, uses the gateway, or touches the
//   guards above, so a human always looks at it.
//
// Adding an operation here is a deliberate, reviewed change: add one narrow
// method per thing the app genuinely needs, never a pass-through to the raw
// client. See "Recurly writes" in AGENTS.md.
//
// Writes are off unless RECURLY_WRITE_TOKEN is set (a separate key from the
// read-only RECURLY_TOKEN), and each one needs an actor and a reason, which
// are logged before the call is made, so there is a record even if Recurly
// times out.
import {Logger} from 'pino';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import recurly from 'recurly';
import {Actor, failure, Failure} from '../types';

type RecurlyWriteClient = Pick<
  recurly.Client,
  'pauseSubscription' | 'resumeSubscription' | 'cancelSubscription'
>;

export type RecurlyWriteClientFactory = (token: string) => RecurlyWriteClient;

// Who asked for the write and why. The gateway does not decide whether the
// actor is allowed to do this to this subscription - the command calling it
// must have checked that already (e.g. that it is the member's own).
export type RecurlyWriteContext = {
  actor: Actor;
  reason: string;
};

export type RecurlyWriteGateway = {
  // Skip the given number of billing cycles; 0 cancels a pending pause.
  pauseSubscription: (
    subscriptionId: string,
    billingCycles: number,
    context: RecurlyWriteContext
  ) => TE.TaskEither<Failure, void>;
  resumeSubscription: (
    subscriptionId: string,
    context: RecurlyWriteContext
  ) => TE.TaskEither<Failure, void>;
  // Stops renewal: the subscription stays active until the end of the period
  // already paid for. Not a refund, and can be undone in Recurly.
  cancelSubscriptionAtTermEnd: (
    subscriptionId: string,
    context: RecurlyWriteContext
  ) => TE.TaskEither<Failure, void>;
};

const describeActor = (actor: Actor): string => {
  switch (actor.tag) {
    case 'system':
      return 'system';
    case 'token':
      return 'admin token';
    case 'user':
      return `member ${actor.user.memberNumber}`;
    case 'public':
      return 'somebody not logged in';
  }
};

const disabledGateway = (logger: Logger): RecurlyWriteGateway => {
  const refuse = (operation: string, subscriptionId: string, context: RecurlyWriteContext) => {
    logger.warn(
      {recurlyWrite: {operation, subscriptionId, actor: describeActor(context.actor), reason: context.reason}},
      'Refused Recurly write: RECURLY_WRITE_TOKEN is not set'
    );
    return TE.left(failure('Recurly writes are not enabled on this deployment')());
  };
  return {
    pauseSubscription: (subscriptionId, _billingCycles, context) =>
      refuse('pauseSubscription', subscriptionId, context),
    resumeSubscription: (subscriptionId, context) =>
      refuse('resumeSubscription', subscriptionId, context),
    cancelSubscriptionAtTermEnd: (subscriptionId, context) =>
      refuse('cancelSubscriptionAtTermEnd', subscriptionId, context),
  };
};

export const initRecurlyWriteGateway = (
  logger: Logger,
  writeToken: string | undefined,
  createClient: RecurlyWriteClientFactory = token => new recurly.Client(token)
): RecurlyWriteGateway => {
  if (!writeToken) {
    return disabledGateway(logger);
  }
  const client = createClient(writeToken);

  const write = (
    operation: string,
    subscriptionId: string,
    context: RecurlyWriteContext,
    call: () => Promise<unknown>
  ): TE.TaskEither<Failure, void> => {
    const fields = {
      recurlyWrite: {
        operation,
        subscriptionId,
        actor: describeActor(context.actor),
        reason: context.reason,
      },
    };
    logger.info(fields, 'Writing to Recurly');
    return pipe(
      TE.tryCatch(call, error => {
        logger.error({...fields, error}, 'Recurly write failed');
        return failure(`Recurly ${operation} failed`)(error);
      }),
      TE.map(() => {
        logger.info(fields, 'Recurly write succeeded');
      })
    );
  };

  return {
    pauseSubscription: (subscriptionId, billingCycles, context) =>
      write('pauseSubscription', subscriptionId, context, () =>
        client.pauseSubscription(subscriptionId, {
          remainingPauseCycles: billingCycles,
        })
      ),
    resumeSubscription: (subscriptionId, context) =>
      write('resumeSubscription', subscriptionId, context, () =>
        client.resumeSubscription(subscriptionId)
      ),
    cancelSubscriptionAtTermEnd: (subscriptionId, context) =>
      write('cancelSubscriptionAtTermEnd', subscriptionId, context, () =>
        client.cancelSubscription(subscriptionId, {
          body: {timeframe: 'term_end'},
        })
      ),
  };
};
