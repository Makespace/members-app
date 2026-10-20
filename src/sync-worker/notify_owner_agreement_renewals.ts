import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import mjml2html from 'mjml';
import {constructEvent, Email} from '../types';
import {SyncWorkerDependencies} from './dependencies';
import {reminderDue} from '../owner-agreement/agreement';
import {ReminderStage} from '../owner-agreement/reminder-stage';
import {displayDateOnly} from '../templates/display-date';

type NotifyOwnerAgreementRenewalsDependencies = Pick<
  SyncWorkerDependencies,
  'logger' | 'sharedReadModel' | 'commitEvent' | 'sendEmail' | 'conf'
>;

const whenEnds: Record<ReminderStage, string> = {
  month: 'in a month',
  week: 'in a week',
  day: 'tomorrow',
};

const buildEmail = (
  publicUrl: string,
  recipient: Email['recipient'],
  stage: ReminderStage,
  termEnds: Date
): Email => {
  const link = `${publicUrl}/members/sign-owner-agreement`;
  const ends = String(displayDateOnly(termEnds));
  const subject = `Your Owners' Agreement ends ${whenEnds[stage]}`;
  const message = `Your term under the Makespace Owners' Agreement ends on ${ends}. To carry on as an owner, please read the agreement again and re-sign it. Your new term will start when the current one ends, so you won't lose any time by renewing now.`;
  return {
    recipient,
    subject,
    text: `${message}\n\n${link}\n`,
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
              <mj-text font-size="16px" color="#111">${message}</mj-text>
              <mj-button background-color="#00703c" href="${link}">Read and re-sign the agreement</mj-button>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `).html,
  };
};

// Reminds owners to re-sign the Owners' Agreement a month, a week and a day
// before their term ends. Each reminder's OwnerAgreementReminderSent marker
// is committed BEFORE sending (preferring a missed email over duplicates,
// matching the other emailers).
export const notifyOwnerAgreementRenewals = async (
  deps: NotifyOwnerAgreementRenewalsDependencies,
  now: Date = new Date()
): Promise<void> => {
  await deps.sharedReadModel.asyncRefresh()();
  const rm = deps.sharedReadModel;

  const due = rm.members
    .getAll()
    .filter(member => member.ownerOf.length > 0)
    .flatMap(member => {
      const stage = reminderDue(member.ownerAgreement, now);
      const termEnds = O.chain(
        (signed: {termEnds: O.Option<Date>}) => signed.termEnds
      )(member.ownerAgreement);
      return O.isSome(stage) && O.isSome(termEnds)
        ? [{member, stage: stage.value, termEnds: termEnds.value}]
        : [];
    });

  for (const {member, stage, termEnds} of due) {
    const commitResp = await deps.commitEvent(rm.getCurrentEventIndex())(
      constructEvent('OwnerAgreementReminderSent')({
        actor: {tag: 'system'},
        memberNumber: member.memberNumber,
        termEnds,
        stage,
      })
    )();
    if (E.isLeft(commitResp)) {
      deps.logger.warn(
        'Failed to record owner agreement reminder for member %s: %o - will retry',
        member.memberNumber,
        commitResp.left
      );
      continue;
    }
    // Catch up with the marker just committed, so the next one commits
    // against the latest event rather than being rejected as out of date.
    await rm.asyncRefresh()();

    deps.logger.info(
      'Sending owner agreement %s reminder to member %s',
      stage,
      member.memberNumber
    );
    const sent = await deps.sendEmail(
      buildEmail(deps.conf.PUBLIC_URL, member.primaryEmailAddress, stage, termEnds)
    )();
    if (E.isLeft(sent)) {
      deps.logger.error(
        'Failed to send owner agreement reminder to member %s: %o',
        member.memberNumber,
        sent.left
      );
    }
  }
};
