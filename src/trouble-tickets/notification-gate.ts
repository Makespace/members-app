import * as TE from 'fp-ts/TaskEither';
import {Logger} from 'pino';
import {Config} from '../configuration';
import {Email, Failure} from '../types';

// Lets the notification stack go live before the mail does.
//
// Everything is worked out as normal - who hears about a ticket, what their
// summary says, what a new role changes - and then this decides whether it
// actually leaves the building. Held-back mail is logged instead, so the logs
// answer "who would this have emailed, about what" against the real machines
// and the real people who look after them. A drill can prove the logic; only
// production can prove the data.

type SendEmail = (email: Email) => TE.TaskEither<Failure, string>;

type Audience =
  | {kind: 'nobody'}
  | {kind: 'everybody'}
  | {kind: 'only'; addresses: ReadonlySet<string>};

// TROUBLE_TICKET_NOTIFY_TO: unset for nobody, 'all' for everybody, or a
// comma-separated list of the only addresses that may be written to.
export const whoMayBeEmailed = (setting: string): Audience => {
  const trimmed = setting.trim();
  if (trimmed === '') {
    return {kind: 'nobody'};
  }
  if (trimmed.toLowerCase() === 'all') {
    return {kind: 'everybody'};
  }
  return {
    kind: 'only',
    addresses: new Set(
      trimmed
        .split(',')
        .map(address => address.trim().toLowerCase())
        .filter(address => address !== '')
    ),
  };
};

export const mayEmail = (audience: Audience, recipient: string): boolean => {
  switch (audience.kind) {
    case 'nobody':
      return false;
    case 'everybody':
      return true;
    case 'only':
      return audience.addresses.has(recipient.trim().toLowerCase());
  }
};

const describeAudience = (audience: Audience): string => {
  switch (audience.kind) {
    case 'nobody':
      return 'nobody - TROUBLE_TICKET_NOTIFY_TO is not set';
    case 'everybody':
      return 'everybody';
    case 'only':
      return `${audience.addresses.size} allowed address(es)`;
  }
};

type GateDependencies = {
  conf: Pick<Config, 'TROUBLE_TICKET_NOTIFY_TO'>;
  logger: Logger;
  sendEmail: SendEmail;
};

export const audienceOf = (deps: Pick<GateDependencies, 'conf'>): Audience =>
  whoMayBeEmailed(deps.conf.TROUBLE_TICKET_NOTIFY_TO);

// A sendEmail that holds back anything not addressed to the allowed list, and
// says in the log what it held and who it was for.
export const heldBackSendEmail =
  (deps: GateDependencies): SendEmail =>
  email => {
    const audience = audienceOf(deps);
    if (mayEmail(audience, email.recipient)) {
      return deps.sendEmail(email);
    }
    deps.logger.info(
      {
        wouldHaveEmailed: email.recipient,
        about: email.subject,
        allowed: describeAudience(audience),
      },
      'Held back a trouble ticket notification'
    );
    return TE.right('held back');
  };
