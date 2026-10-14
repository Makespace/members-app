import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import mjml2html from 'mjml';
import {constructEvent, Email} from '../types';
import {EmailAddress} from '../types/email-address';
import {StoredEventOfType} from '../types/domain-event';
import {SyncWorkerDependencies} from './dependencies';
import {
  audienceOf,
  heldBackSendEmail,
  mayEmail,
} from '../trouble-tickets/notification-gate';
import {
  introBannerHtml,
  introBannerText,
  shouldIntroduce,
} from '../templates/trouble-ticket-email';

// A role change that cannot be acted on is reconsidered every cycle, so
// saying so every time would be thousands of identical lines a day. Once per
// change, per run of the worker, is enough to know it is waiting.
const announced = new Set<number>();

// The set above outlives a single call, which is the point of it. Tests need
// a way back to a clean worker.
export const forgetAnnouncedRoleChanges = (): void => announced.clear();

// Taking on a machine or an area is taking on the job of looking after it, and
// hearing about it is part of that job. So a role change sets what somebody
// hears, even over a choice they made earlier - and tells them it has, with a
// link to change it back. Opting out afterwards is theirs to do; opting out by
// never being opted in is not.

const ROLE_TYPES = [
  'TrainerAdded',
  'TrainerRemoved',
  'OwnerAdded',
] as const;

type RoleEvent = StoredEventOfType<(typeof ROLE_TYPES)[number]>;

// Far enough back to cover a worker that has been down for a few days, and
// nowhere near far enough to reach the history.
const REACT_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

type NotifyRoleChangeDependencies = Pick<
  SyncWorkerDependencies,
  | 'logger'
  | 'sharedReadModel'
  | 'getAllEventsByType'
  | 'commitEvent'
  | 'sendEmail'
  | 'conf'
>;

type Intent = {
  scope: string;
  // What the rule should become. 'follow' puts it back to taking whatever
  // sits above it, which is how a rule we set earlier is undone.
  preference: 'daily' | 'follow';
  thing: string;
  became: string;
};

const intentOf = (
  event: RoleEvent,
  deps: NotifyRoleChangeDependencies
): O.Option<Intent> => {
  const rm = deps.sharedReadModel;
  switch (event.type) {
    case 'TrainerAdded':
      return O.map((equipment: {name: string}) => ({
        scope: `equipment:${event.equipmentId}`,
        preference: 'daily' as const,
        thing: equipment.name,
        became: 'a trainer on',
      }))(rm.equipment.get(event.equipmentId));
    case 'TrainerRemoved':
      return O.map((equipment: {name: string}) => ({
        scope: `equipment:${event.equipmentId}`,
        preference: 'follow' as const,
        thing: equipment.name,
        became: 'no longer a trainer on',
      }))(rm.equipment.get(event.equipmentId));
    case 'OwnerAdded':
      // An area somebody owns already sits in their own areas, so the rule
      // only needs clearing: anything they said while it was somebody else's
      // area stops applying.
      return O.map((area: {name: string}) => ({
        scope: `area:${event.areaId}`,
        preference: 'follow' as const,
        thing: area.name,
        became: 'an owner of',
      }))(rm.area.get(event.areaId));
  }
};

export const notifyRoleChanges = async (
  deps: NotifyRoleChangeDependencies,
  now: Date = new Date()
): Promise<void> => {
  await deps.sharedReadModel.asyncRefresh()();
  const rm = deps.sharedReadModel;

  const fetched = await Promise.all(
    ROLE_TYPES.map(type => deps.getAllEventsByType(type)())
  );
  const roleEvents: RoleEvent[] = [];
  for (const result of fetched) {
    if (E.isRight(result)) {
      roleEvents.push(...result.right);
    } else {
      deps.logger.warn(
        'Failed to read role changes for notifications: %o',
        result.left
      );
    }
  }
  roleEvents.sort((a, b) => a.event_index - b.event_index);

  // What we have already done about a role change, so that reacting twice
  // cannot happen - and so that somebody who changes the rule back afterwards
  // is not overruled again on the next pass.
  const alreadyDone = await deps.getAllEventsByType(
    'MemberNotificationPreferenceSet'
  )();
  const handled = E.isRight(alreadyDone)
    ? alreadyDone.right.filter(event => event.actor.tag === 'system')
    : [];

  for (const event of roleEvents) {
    if (now.getTime() - event.recordedAt.getTime() > REACT_WITHIN_MS) {
      continue;
    }
    const intent = intentOf(event, deps);
    if (O.isNone(intent)) {
      continue;
    }
    const {scope, preference, thing, became} = intent.value;
    const seen = handled.some(
      done =>
        done.memberNumber === event.memberNumber &&
        done.scope === scope &&
        done.event_index > event.event_index
    );
    if (seen) {
      continue;
    }
    const member = rm.members.getByMemberNumber(event.memberNumber);
    if (O.isNone(member)) {
      continue;
    }

    // Overruling somebody's choice is only fair because they are told it
    // happened and given the link to undo it. With the mail held back, the
    // telling cannot happen, so neither does the overruling - the whole
    // reaction waits until there is somebody to send it to.
    if (!mayEmail(audienceOf(deps), member.value.primaryEmailAddress)) {
      if (!announced.has(event.event_index)) {
        announced.add(event.event_index);
        deps.logger.info(
          {
            memberNumber: event.memberNumber,
            scope,
            wouldHaveEmailed: member.value.primaryEmailAddress,
          },
          'Held back a role change, so their notifications are left as they are'
        );
      }
      continue;
    }

    const introduce = shouldIntroduce(
      rm.notificationPreferences.emailsSentTo(event.memberNumber)
    );
    const committed = await deps.commitEvent(rm.getCurrentEventIndex())(
      constructEvent('MemberNotificationPreferenceSet')({
        actor: {tag: 'system'},
        memberNumber: event.memberNumber,
        scope,
        preference,
        notified: true,
      })
    )();
    if (E.isLeft(committed)) {
      deps.logger.warn(
        {memberNumber: event.memberNumber, scope, failure: committed.left},
        'Could not follow a role change through to notifications'
      );
      continue;
    }

    const sent = await heldBackSendEmail(deps)(
      buildRoleChangeEmail(
        deps.conf.PUBLIC_URL,
        member.value.primaryEmailAddress,
        thing,
        became,
        preference,
        introduce
      )
    )();
    if (E.isLeft(sent)) {
      deps.logger.error(
        {memberNumber: event.memberNumber, scope, failure: sent.left},
        'Failed to tell somebody their notifications changed'
      );
    }
  }
};

const buildRoleChangeEmail = (
  publicUrl: string,
  recipient: EmailAddress,
  thing: string,
  became: string,
  preference: 'daily' | 'follow',
  introduce: boolean
): Email => {
  const nowHears =
    preference === 'daily'
      ? `You will get a daily summary of anything reported about ${thing}.`
      : `What you hear about ${thing} now follows whatever you have chosen for the area it is in.`;
  const subject = `You are now ${became} ${thing}`;
  const text = [
    'Hello,',
    '',
    `You are now ${became} ${thing}, so we have changed what you hear about it.`,
    '',
    nowHears,
    '',
    `If that is not what you want, you can change it: ${publicUrl}/notification-settings`,
  ]
    .concat(introduce ? ['', introBannerText(publicUrl)] : [])
    .join('\n');

  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return {
    recipient,
    subject,
    text,
    html: mjml2html(`
      <mjml>
        <mj-body width="600px">
          <mj-section background-color="#fa990e">
            <mj-column>
              <mj-text align="center" color="#111" font-size="28px">Makespace</mj-text>
            </mj-column>
          </mj-section>
          <mj-section>
            <mj-column>
              ${introduce ? `<mj-raw>${introBannerHtml(publicUrl)}</mj-raw>` : ''}
              <mj-text font-size="16px" color="#111">
                <p>You are now ${escape(became)} <strong>${escape(thing)}</strong>, so we have changed what you hear about it.</p>
                <p>${escape(nowHears)}</p>
              </mj-text>
              <mj-button background-color="#00703c" href="${publicUrl}/notification-settings">Change what you hear about</mj-button>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `).html,
  };
};
