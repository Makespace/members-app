#!/usr/bin/env -S npx tsx
/**
 * A drill for the trouble ticket notification stack.
 *
 * Builds a throwaway in-memory copy of the app, plays out a situation in it
 * with real events, runs the real notification jobs against it, and reports
 * who was told what. Nothing touches a real event store or a real member.
 *
 * By default it only prints. With --send it sends the emails for real, every
 * imaginary person's address plus-addressed off DRILL_TO, so one inbox
 * receives the lot and the mail client keeps them apart. That is the one
 * thing a unit test cannot do: show what these emails actually look like
 * when they land.
 *
 * It runs under Node rather than bun, because the read model it builds uses
 * better-sqlite3 and bun cannot load it. `make notification-drill` is the
 * short way in.
 *
 *   ./scripts/notification-drill.ts                     print what would go out
 *   ./scripts/notification-drill.ts --list              the situations it plays
 *   ./scripts/notification-drill.ts --only weekly,live  just those
 *   ./scripts/notification-drill.ts --text              with the full wording
 *   ./scripts/notification-drill.ts --html <dir>        write them out to look at
 *
 *   DRILL_TO=you@example.com SMTP_HOST=... SMTP_USER=... SMTP_PASSWORD=... \
 *     ./scripts/notification-drill.ts --send
 *
 * Every situation also says who it expects to hear and who it expects to be
 * left alone, so the drill fails loudly if the stack stops behaving - which
 * makes it an acceptance test of the whole chain, not just a mail generator.
 */

import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import nodemailer from 'nodemailer';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent, Email} from '../src/types';
import {EmailAddress} from '../src/types/email-address';
import {Config} from '../src/configuration';
import {notifyTroubleTicketChanges} from '../src/sync-worker/notify_trouble_tickets';
import {notifyDigests} from '../src/sync-worker/notify_digests';
import {notifyRoleChanges} from '../src/sync-worker/notify_role_changes';
import {
  initTestFramework,
  TestFramework,
} from '../tests/read-models/test-framework';

const DAY_MS = 24 * 60 * 60 * 1000;
const PUBLIC_URL = 'https://members.makespace.org';

// ---------------------------------------------------------------- the cast

type Persona = {
  tag: string;
  memberNumber: number;
  name: string;
};

const CAST = {
  owner: {tag: 'owner', memberNumber: 9001, name: 'Area Owner'},
  trainer: {tag: 'trainer', memberNumber: 9002, name: 'Machine Trainer'},
  keen: {tag: 'keen', memberNumber: 9003, name: 'Wants It Live'},
  quiet: {tag: 'quiet', memberNumber: 9004, name: 'Wants Nothing'},
  newcomer: {tag: 'newcomer', memberNumber: 9005, name: 'Just Appointed'},
  reporter: {tag: 'reporter', memberNumber: 9006, name: 'Reported It'},
} satisfies Record<string, Persona>;

// One inbox receives everybody, told apart by the bit after the plus.
const addressFor = (base: string, persona: Persona): EmailAddress => {
  const [name, host] = base.split('@');
  return `${name}+${persona.tag}@${host}` as EmailAddress;
};

// --------------------------------------------------------------- the stage

type Expectation = {
  who: Persona;
  subject: string;
  mentions?: ReadonlyArray<string>;
};

type Outcome = {
  expected: ReadonlyArray<Expectation>;
  // Anybody named here must have been left completely alone.
  silent?: ReadonlyArray<Persona>;
};

type Stage = {
  join: (persona: Persona) => Promise<void>;
  area: (name: string) => Promise<UUID>;
  machine: (name: string, areaId: UUID) => Promise<UUID>;
  own: (areaId: UUID, persona: Persona) => Promise<void>;
  train: (equipmentId: UUID, persona: Persona) => Promise<void>;
  untrain: (equipmentId: UUID, persona: Persona) => Promise<void>;
  prefer: (
    persona: Persona,
    scope: string,
    preference: 'live' | 'daily' | 'weekly' | 'none' | 'follow'
  ) => Promise<void>;
  raise: (opts: {
    issue: string;
    equipmentId: UUID;
    by?: Persona;
  }) => Promise<UUID>;
  assign: (ticketId: UUID, to: Persona) => Promise<void>;
  resolve: (ticketId: UUID, summary: string) => Promise<void>;
  // Reacting to the roles set up so far and forgetting the emails, so a
  // situation can start with people already in post.
  alreadyInPost: () => Promise<void>;
  live: (now?: Date) => Promise<void>;
  digests: (now?: Date) => Promise<void>;
  roles: (now?: Date) => Promise<void>;
  everything: (now?: Date) => Promise<void>;
};

type Situation = {
  key: string;
  what: string;
  play: (stage: Stage) => Promise<Outcome>;
};

const buildStage = (
  framework: TestFramework,
  base: string,
  sent: Email[]
): Stage => {
  const deps = () => ({
    logger: framework.depsForCommands.logger,
    sharedReadModel: framework.sharedReadModel,
    getAllEventsByType: framework.depsForCommands.getAllEventsByType,
    commitEvent: framework.depsForCommands.commitEvent,
    sendEmail: (email: Email) => {
      sent.push(email);
      return TE.right('sent' as const);
    },
    conf: {
      PUBLIC_URL,
      // The drill is the one place that always wants the mail worked out and
      // handed over; whether it then leaves the building is --send's job.
      TROUBLE_TICKET_NOTIFY_TO: 'all',
    } as unknown as Config,
  });

  const commit = (event: Parameters<ReturnType<TestFramework['depsForCommands']['commitEvent']>>[0]) =>
    framework.depsForCommands.commitEvent(
      framework.sharedReadModel.getCurrentEventIndex()
    )(event)();

  return {
    join: async persona => {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: persona.memberNumber,
        email: addressFor(base, persona),
        name: persona.name as NonEmptyString,
        formOfAddress: undefined,
      });
    },
    area: async name => {
      const id = faker.string.uuid() as UUID;
      await framework.commands.area.create({id, name: name as NonEmptyString});
      return id;
    },
    machine: async (name, areaId) => {
      const id = faker.string.uuid() as UUID;
      await framework.commands.equipment.add({
        id,
        name: name as NonEmptyString,
        areaId,
      });
      return id;
    },
    own: async (areaId, persona) => {
      await framework.commands.area.addOwner({
        areaId,
        memberNumber: persona.memberNumber,
      });
    },
    train: async (equipmentId, persona) => {
      await framework.commands.trainers.add({
        equipmentId,
        memberNumber: persona.memberNumber,
      });
    },
    untrain: async (equipmentId, persona) => {
      await framework.commands.trainers.remove({
        equipmentId,
        memberNumber: persona.memberNumber,
      });
    },
    prefer: async (persona, scope, preference) => {
      await framework.commands.notificationPreferences.set({
        memberNumber: persona.memberNumber,
        scope: scope as NonEmptyString,
        preference,
      });
    },
    raise: async ({issue, equipmentId, by}) => {
      const id = faker.string.uuid() as UUID;
      await commit(
        constructEvent('TroubleTicketCreated')({
          actor: {tag: 'system'},
          id,
          rowHash: faker.string.hexadecimal({length: 64}),
          sheetId: 'drill',
          submittedAt: new Date(),
          submittedMemberNumber: by === undefined ? null : by.memberNumber,
          submittedEmail: by === undefined ? null : addressFor(base, by),
          submittedName: by === undefined ? null : by.name,
          submittedEquipment: '',
          equipmentId,
          machine: '',
          areaId: null,
          title: issue,
          mailboxConversationId: '',
          source: 'sheet',
          otherEquipmentDetail: '',
          status: 'Broken',
          attempting: '',
          issue,
          steps: '',
        })
      );
      return id;
    },
    assign: async (ticketId, to) => {
      await commit(
        constructEvent('TroubleTicketAssigned')({
          actor: {tag: 'system'},
          ticketId,
          trainerMemberNumber: to.memberNumber,
          comment: '',
        })
      );
    },
    resolve: async (ticketId, summary) => {
      await commit(
        constructEvent('TroubleTicketResolved')({
          actor: {tag: 'system'},
          ticketId,
          summary,
          quiet: false,
        })
      );
    },
    alreadyInPost: async () => {
      await notifyRoleChanges(deps());
      sent.length = 0;
    },
    live: async now => {
      await notifyTroubleTicketChanges(deps(), now);
    },
    digests: async now => {
      await notifyDigests(deps(), now);
    },
    roles: async now => {
      await notifyRoleChanges(deps(), now);
    },
    everything: async now => {
      await notifyRoleChanges(deps(), now);
      await notifyTroubleTicketChanges(deps(), now);
      await notifyDigests(deps(), now);
    },
  };
};

// ----------------------------------------------------------- the situations

const SITUATIONS: ReadonlyArray<Situation> = [
  {
    key: 'weekly',
    what: 'An area owner who has said nothing gets one summary a week',
    play: async stage => {
      await stage.join(CAST.owner);
      const wood = await stage.area('Wood Shop');
      const saw = await stage.machine('Band Saw', wood);
      const planer = await stage.machine('Thicknesser', wood);
      await stage.own(wood, CAST.owner);
      await stage.alreadyInPost();

      await stage.raise({issue: 'The blade is blunt', equipmentId: saw});
      await stage.raise({issue: 'It keeps tripping out', equipmentId: planer});
      await stage.digests();

      return {
        expected: [
          {
            who: CAST.owner,
            subject: 'this week',
            mentions: ['The blade is blunt', 'It keeps tripping out', 'Band Saw'],
          },
        ],
      };
    },
  },
  {
    key: 'daily-machine',
    what: 'A trainer hears about their own machine daily, the rest of the area weekly',
    play: async stage => {
      await stage.join(CAST.trainer);
      const wood = await stage.area('Wood Shop');
      const saw = await stage.machine('Band Saw', wood);
      const lathe = await stage.machine('Wood Lathe', wood);
      await stage.own(wood, CAST.trainer);
      await stage.train(saw, CAST.trainer);
      await stage.alreadyInPost();

      await stage.raise({issue: 'The blade is blunt', equipmentId: saw});
      await stage.raise({issue: 'The tailstock is seized', equipmentId: lathe});
      await stage.digests();

      return {
        expected: [
          {
            who: CAST.trainer,
            subject: 'today',
            mentions: ['The blade is blunt'],
          },
          {
            who: CAST.trainer,
            subject: 'this week',
            mentions: ['The tailstock is seized'],
          },
        ],
      };
    },
  },
  {
    key: 'live',
    what: 'Somebody who asked to hear as it happens hears each change at once',
    play: async stage => {
      await stage.join(CAST.keen);
      const metal = await stage.area('Metal Shop');
      const mill = await stage.machine('Milling Machine', metal);
      await stage.own(metal, CAST.keen);
      await stage.alreadyInPost();
      await stage.prefer(CAST.keen, 'my-areas', 'live');

      const ticket = await stage.raise({
        issue: 'The coolant pump has stopped',
        equipmentId: mill,
      });
      await stage.live();
      await stage.resolve(ticket, 'Replaced the pump');
      await stage.live();

      return {
        expected: [
          // Not their report, so not thanked for it.
          {who: CAST.keen, subject: 'New trouble ticket: The coolant pump'},
          {who: CAST.keen, subject: 'Trouble ticket update: The coolant pump'},
        ],
      };
    },
  },
  {
    key: 'opted-out',
    what: 'Somebody who asked for nothing is left alone by every job',
    play: async stage => {
      await stage.join(CAST.quiet);
      const wood = await stage.area('Wood Shop');
      const saw = await stage.machine('Band Saw', wood);
      await stage.own(wood, CAST.quiet);
      await stage.alreadyInPost();
      await stage.prefer(CAST.quiet, 'my-areas', 'none');

      const ticket = await stage.raise({
        issue: 'The fence will not lock',
        equipmentId: saw,
      });
      await stage.resolve(ticket, 'Tightened the cam');
      await stage.everything();

      return {expected: [], silent: [CAST.quiet]};
    },
  },
  {
    key: 'quiet-week',
    what: 'A week with nothing in it costs nobody an email',
    play: async stage => {
      await stage.join(CAST.owner);
      const wood = await stage.area('Wood Shop');
      await stage.machine('Band Saw', wood);
      await stage.own(wood, CAST.owner);
      await stage.alreadyInPost();

      await stage.digests();
      await stage.digests(new Date(Date.now() + 8 * DAY_MS));

      return {expected: [], silent: [CAST.owner]};
    },
  },
  {
    key: 'made-trainer',
    what: 'Being made a trainer puts that machine on a daily summary, and says so',
    play: async stage => {
      await stage.join(CAST.newcomer);
      const wood = await stage.area('Wood Shop');
      const saw = await stage.machine('Band Saw', wood);
      await stage.own(wood, CAST.newcomer);
      await stage.alreadyInPost();

      await stage.train(saw, CAST.newcomer);
      await stage.roles();

      return {
        expected: [
          {
            who: CAST.newcomer,
            subject: 'a trainer on Band Saw',
            mentions: ['daily summary', '/notification-settings'],
          },
        ],
      };
    },
  },
  {
    key: 'trainer-removed',
    what: 'Giving up a machine puts it back to following its area, and says so',
    play: async stage => {
      await stage.join(CAST.newcomer);
      const wood = await stage.area('Wood Shop');
      const saw = await stage.machine('Band Saw', wood);
      await stage.own(wood, CAST.newcomer);
      await stage.train(saw, CAST.newcomer);
      await stage.alreadyInPost();

      await stage.untrain(saw, CAST.newcomer);
      await stage.roles();

      return {
        expected: [
          {
            who: CAST.newcomer,
            subject: 'no longer a trainer on Band Saw',
            mentions: ['/notification-settings'],
          },
        ],
      };
    },
  },
  {
    key: 'made-owner',
    what: 'Taking on an area overrules what was said about it beforehand',
    play: async stage => {
      await stage.join(CAST.newcomer);
      const wood = await stage.area('Wood Shop');
      await stage.machine('Band Saw', wood);
      // Said while it was somebody else's area to look after.
      await stage.prefer(CAST.newcomer, `area:${wood}`, 'none');

      await stage.own(wood, CAST.newcomer);
      await stage.roles();

      return {
        expected: [
          {
            who: CAST.newcomer,
            subject: 'an owner of Wood Shop',
            mentions: ['/notification-settings'],
          },
        ],
      };
    },
  },
  {
    key: 'overridden-machine',
    what: 'One machine set to live beats the weekly summary set on its area',
    play: async stage => {
      await stage.join(CAST.owner);
      const wood = await stage.area('Wood Shop');
      const saw = await stage.machine('Band Saw', wood);
      const lathe = await stage.machine('Wood Lathe', wood);
      await stage.own(wood, CAST.owner);
      await stage.alreadyInPost();
      await stage.prefer(CAST.owner, `equipment:${saw}`, 'live');

      await stage.raise({issue: 'The blade has snapped', equipmentId: saw});
      await stage.raise({issue: 'The belt squeals', equipmentId: lathe});
      await stage.everything();

      return {
        expected: [
          {who: CAST.owner, subject: 'New trouble ticket: The blade has snapped'},
          {
            who: CAST.owner,
            subject: 'this week',
            mentions: ['The belt squeals'],
          },
        ],
      };
    },
  },
  {
    key: 'my-own-machine',
    what: 'Reporting a fault on your own machine: told at once, and still in the summary',
    play: async stage => {
      await stage.join(CAST.trainer);
      const wood = await stage.area('Wood Shop');
      const saw = await stage.machine('Band Saw', wood);
      await stage.own(wood, CAST.trainer);
      await stage.train(saw, CAST.trainer);
      await stage.alreadyInPost();

      // Their own report, on the machine they look after: live because they
      // reported it, daily because it is theirs. Both are true.
      await stage.raise({
        issue: 'The blade is wandering',
        equipmentId: saw,
        by: CAST.trainer,
      });
      await stage.raise({issue: 'The guard rattles', equipmentId: saw});
      await stage.everything();

      return {
        expected: [
          {
            who: CAST.trainer,
            subject: "We've logged your report: The blade is wandering",
          },
          // The other one is on a daily rule and nothing more, so it waits
          // for the summary rather than arriving twice.
          {
            who: CAST.trainer,
            subject: 'today',
            // The day's record is complete: the one they were emailed about
            // is counted alongside the one they were not.
            mentions: ['The blade is wandering', 'The guard rattles'],
          },
        ],
      };
    },
  },
  {
    key: 'reporter',
    what: 'Whoever reported a ticket hears what happened to it, straight away',
    play: async stage => {
      await stage.join(CAST.reporter);
      const wood = await stage.area('Wood Shop');
      const saw = await stage.machine('Band Saw', wood);

      const ticket = await stage.raise({
        issue: 'The guard is cracked',
        equipmentId: saw,
        by: CAST.reporter,
      });
      await stage.live();
      await stage.resolve(ticket, 'Fitted a new guard');
      await stage.live();

      return {
        expected: [
          {who: CAST.reporter, subject: "We've logged your report: The guard is cracked"},
          {who: CAST.reporter, subject: 'Trouble ticket update: The guard is cracked'},
        ],
      };
    },
  },
];

// -------------------------------------------------------------- the running

type Note = {ok: boolean; line: string};

const checkOutcome = (
  base: string,
  sent: ReadonlyArray<Email>,
  outcome: Outcome
): ReadonlyArray<Note> => {
  const notes: Note[] = [];
  const unclaimed = [...sent];

  for (const want of outcome.expected) {
    const address = addressFor(base, want.who);
    const index = unclaimed.findIndex(
      email =>
        email.recipient === address && email.subject.includes(want.subject)
    );
    if (index === -1) {
      notes.push({
        ok: false,
        line: `${want.who.tag} was never sent anything about "${want.subject}"`,
      });
      continue;
    }
    const [email] = unclaimed.splice(index, 1);
    const missing = (want.mentions ?? []).filter(
      phrase => !email.text.includes(phrase)
    );
    notes.push(
      missing.length === 0
        ? {ok: true, line: `${want.who.tag} <- ${email.subject}`}
        : {
            ok: false,
            line: `${want.who.tag} <- ${email.subject}, but it never says ${missing
              .map(phrase => `"${phrase}"`)
              .join(' or ')}`,
          }
    );
  }

  for (const who of outcome.silent ?? []) {
    const address = addressFor(base, who);
    const strays = sent.filter(email => email.recipient === address);
    notes.push(
      strays.length === 0
        ? {ok: true, line: `${who.tag} was left alone, as they asked`}
        : {
            ok: false,
            line: `${who.tag} should have heard nothing but got ${strays.length}: ${strays
              .map(email => email.subject)
              .join('; ')}`,
          }
    );
  }

  for (const email of unclaimed) {
    notes.push({
      ok: false,
      line: `nobody expected this: ${email.recipient} <- ${email.subject}`,
    });
  }

  return notes;
};

const transportFromEnv = () => {
  const host = process.env.SMTP_HOST;
  if (host === undefined || host === '') {
    throw new Error('SMTP_HOST is not set, so --send has nowhere to send');
  }
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 2525),
    auth: {
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASSWORD ?? '',
    },
    requireTLS: process.env.SMTP_TLS !== 'false',
  });
};

const main = async () => {
  const args = process.argv.slice(2);
  const sending = args.includes('--send');
  const showText = args.includes('--text');
  // Writing the HTML out is the only way to see what these actually look
  // like without sending one.
  const htmlDir =
    args.indexOf('--html') === -1
      ? undefined
      : args[args.indexOf('--html') + 1];
  if (htmlDir !== undefined) {
    mkdirSync(htmlDir, {recursive: true});
  }
  const onlyArg = args.find(arg => arg.startsWith('--only'));
  const only =
    onlyArg === undefined
      ? undefined
      : new Set(
          (onlyArg.includes('=')
            ? onlyArg.split('=')[1]
            : (args[args.indexOf(onlyArg) + 1] ?? '')
          )
            .split(',')
            .filter(key => key !== '')
        );

  if (args.includes('--list')) {
    for (const situation of SITUATIONS) {
      console.log(`${situation.key.padEnd(20)}${situation.what}`);
    }
    return;
  }

  // Nobody's address appears in here: in print mode it is made up, and for
  // real sending it is whichever inbox was named on the command line.
  const base = process.env.DRILL_TO ?? 'nobody@example.test';
  if (sending && process.env.DRILL_TO === undefined) {
    throw new Error(
      'Set DRILL_TO to the inbox that should receive the drill before using --send'
    );
  }

  const transport = sending ? transportFromEnv() : undefined;
  const from = process.env.SMTP_FROM ?? 'do-not-reply@makespace.org';

  const chosen = SITUATIONS.filter(
    situation => only === undefined || only.has(situation.key)
  );
  if (chosen.length === 0) {
    throw new Error('None of those situations exist - try --list');
  }

  console.log(
    sending
      ? `Playing ${chosen.length} situations and sending the emails to ${base}\n`
      : `Playing ${chosen.length} situations. Nothing will be sent - add --send for that.\n`
  );

  let failed = 0;
  let posted = 0;

  for (const situation of chosen) {
    const framework = await initTestFramework();
    const sent: Email[] = [];
    try {
      const outcome = await situation.play(buildStage(framework, base, sent));
      const notes = checkOutcome(base, sent, outcome);
      const wrong = notes.filter(note => !note.ok).length;
      failed += wrong;

      console.log(`${wrong === 0 ? 'ok  ' : 'FAIL'} ${situation.key} - ${situation.what}`);
      for (const note of notes) {
        console.log(`       ${note.ok ? '.' : '!'} ${note.line}`);
      }
      if (showText) {
        for (const email of sent) {
          console.log(
            `\n       --- ${email.recipient}: ${email.subject} ---\n${email.text
              .split('\n')
              .map(line => `       ${line}`)
              .join('\n')}\n`
          );
        }
      }

      if (htmlDir !== undefined) {
        sent.forEach((email, index) => {
          const file = join(
            htmlDir,
            `${situation.key}-${index + 1}.html`
          );
          writeFileSync(file, email.html);
          console.log(`       wrote ${file}`);
        });
      }

      if (transport !== undefined) {
        for (const email of sent) {
          await transport.sendMail({
            from,
            to: email.recipient,
            // Named so a mailbox full of these can be read.
            subject: `[drill: ${situation.key}] ${email.subject}`,
            text: email.text,
            html: email.html,
          });
          posted += 1;
        }
      }
    } finally {
      framework.close();
    }
  }

  console.log(
    `\n${failed === 0 ? 'Everything behaved' : `${failed} things did not behave`}${
      transport === undefined ? '' : `, ${posted} emails posted to ${base}`
    }.`
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
