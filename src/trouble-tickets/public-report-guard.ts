import {BlockList, isIP} from 'net';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {Config} from '../configuration';
import {createSignedToken, verifyToken} from '../authentication/signed-token';

// The checks a report from somebody who is not logged in has to pass. The
// form is public - on QR codes stuck to the machines - so it will be found by
// bots. None of this is a wall; together they turn away the cheap, common
// kinds, and the emails it sends carry nothing a spammer could use (see
// notify_trouble_tickets).

// A field people never see, and form-filling bots fill in.
export const HONEYPOT_FIELD = 'website';

// When the form was handed out, signed so it cannot be made up: a post with
// no form behind it, or one sent faster than anybody could type, is not a
// person reporting a problem.
export const FORM_TOKEN_FIELD = 'formToken';

const MIN_FILL_MS = 3 * 1000;

const FormTokenPayload = t.type({
  purpose: t.literal('PublicTroubleTicketForm'),
  issuedAt: t.number,
});

export const createFormToken = (conf: Config, now: Date = new Date()) =>
  createSignedToken<t.TypeOf<typeof FormTokenPayload>>(
    conf,
    // A tab left open overnight still works the next day.
    '1d'
  )({purpose: 'PublicTroubleTicketForm', issuedAt: now.getTime()});

type Verdict =
  | {tag: 'accept'}
  // Pretend it worked: telling a bot why only teaches it.
  | {tag: 'drop'; reason: string}
  // A person might have tripped it, so say what to do.
  | {tag: 'refuse'; reason: string; message: string; status: 400 | 429};

const field = (body: unknown, name: string): string => {
  const value =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)[name]
      : undefined;
  return typeof value === 'string' ? value : '';
};

const checkFormToken = (
  conf: Config,
  body: unknown,
  now: Date
): Verdict => {
  const token = field(body, FORM_TOKEN_FIELD);
  return pipe(
    verifyToken(token, conf.TOKEN_SECRET),
    E.chainW(FormTokenPayload.decode),
    E.match(
      (): Verdict => ({
        tag: 'refuse',
        reason: 'missing or invalid form token',
        message:
          'This form has expired. Please reload the page and send your report again.',
        status: 400,
      }),
      ({issuedAt}): Verdict =>
        now.getTime() - issuedAt < MIN_FILL_MS
          ? {
              tag: 'refuse',
              reason: 'sent too soon after the form was shown',
              message:
                'That was quicker than we expected. Please check your report and send it again.',
              status: 400,
            }
          : {tag: 'accept'}
    )
  );
};

// How many times something may happen in a window, remembered in memory.
// The app runs as one machine, and a restart forgetting the counts is fine.
class RateLimiter {
  private readonly seen = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  // Counts this attempt when it is allowed.
  allow(key: string, now: Date): boolean {
    const since = now.getTime() - this.windowMs;
    const recent = (this.seen.get(key) ?? []).filter(at => at > since);
    if (recent.length >= this.limit) {
      this.seen.set(key, recent);
      return false;
    }
    recent.push(now.getTime());
    this.seen.set(key, recent);
    return true;
  }
}

const HOUR = 60 * 60 * 1000;

// The addresses Makespace's own connection comes from. Everybody at the space
// shares one, so a busy open evening could look like one sender; and outside
// spam filling the overall limit should not stop somebody at a broken
// machine from reporting it.
const spaceNetwork = (addresses: string): BlockList => {
  const list = new BlockList();
  for (const entry of addresses.split(',').map(part => part.trim())) {
    const [address, prefix] = entry.split('/');
    const family = isIP(address);
    if (family === 0) {
      continue;
    }
    const type = family === 6 ? 'ipv6' : 'ipv4';
    if (prefix === undefined) {
      list.addAddress(address, type);
    } else if (/^\d+$/.test(prefix)) {
      list.addSubnet(address, Number(prefix), type);
    }
  }
  return list;
};

const isFrom = (network: BlockList, clientIp: string): boolean => {
  const family = isIP(clientIp);
  return (
    family !== 0 && network.check(clientIp, family === 6 ? 'ipv6' : 'ipv4')
  );
};

export type PublicReportGuard = (
  body: unknown,
  clientIp: string,
  now?: Date
) => Verdict;

// A workshop full of people at an open evening could share one address, so
// the per-address limit is not tight. The overall limit is the backstop: a
// normal week sees a handful of reports, so a few dozen in an hour is
// somebody automating it, and the owners' inboxes should not pay for that.
export const publicReportGuard = (
  conf: Config,
  limits: {perClientPerHour: number; overallPerHour: number} = {
    perClientPerHour: 5,
    overallPerHour: 30,
  }
): PublicReportGuard => {
  const space = spaceNetwork(conf.MAKESPACE_NETWORK_ADDRESSES ?? '');
  const perClient = new RateLimiter(limits.perClientPerHour, HOUR);
  const overall = new RateLimiter(limits.overallPerHour, HOUR);
  return (body, clientIp, now = new Date()) => {
    if (field(body, HONEYPOT_FIELD).trim() !== '') {
      return {tag: 'drop', reason: 'honeypot filled in'};
    }
    const token = checkFormToken(conf, body, now);
    if (token.tag !== 'accept') {
      return token;
    }
    // Not counted either, so the space never uses up the overall limit.
    if (isFrom(space, clientIp)) {
      return {tag: 'accept'};
    }
    if (!perClient.allow(clientIp, now) || !overall.allow('all', now)) {
      return {
        tag: 'refuse',
        reason: 'rate limited',
        message:
          "We've had a lot of reports in a short time, so we can't take this one right now. Please try again later, log in and report it, or email owners@makespace.org.",
        status: 429,
      };
    }
    return {tag: 'accept'};
  };
};
