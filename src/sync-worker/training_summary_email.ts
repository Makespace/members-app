import {DateTime, Duration} from 'luxon';
import {constructEvent, Email, EmailAddress} from '../types';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as S from 'fp-ts/string';
import * as RA from 'fp-ts/ReadonlyArray';
import {Equipment, Owner} from '../read-models/shared-state/return-types';
import mjml2html from 'mjml';
import {SanitizedString, sanitizeString} from '../types/html';
import {getFullQuizResults} from '../read-models/external-state/equipment-quiz';
import {pipe} from 'fp-ts/lib/function';
import {contramap} from 'fp-ts/lib/Ord';
import {Config} from '../configuration';
import {SyncWorkerDependencies} from './dependencies';
import {readModels} from '../read-models';

// Temporary
// const TRAINING_SUMMARY_EMAIL_ALLOWLIST: number[] = [1741, 131, 1698, 1725];
const TRAINING_SUMMARY_EMAIL_ALLOWLIST: number[] = [1741];
const TRAINING_SUMMARY_EMAIL_INTERVAL: Duration = Duration.fromObject({
  // week: 1,
  minutes: 30, // Temp for testing.
});

type TrainingSummaryDeps = Pick<
  SyncWorkerDependencies,
  | 'sendEmail'
  | 'sharedReadModel'
  | 'logger'
  | 'commitEvent'
  | 'lastQuizSync'
  | 'getSheetData'
  | 'getResourceEvents'
> & {
  conf: Config;
};

type EquipmentTrainingStats = {
  name: SanitizedString;
  awaitingTraining: O.Option<number>;
  trainedTotal: number;
  trainedLast30Days: number;
  equipmentLink: URL;
  trainerCount: number;
  percentageOfActiveMembershipTrained: number;
};

type EmailContent = {
  trainingStatsPerEquipment: ReadonlyArray<EquipmentTrainingStats>;
  totalActiveMembers: number;
  membersJoinedWithin30Days: number;
};

const byName = pipe(
  S.Ord,
  contramap((e: EquipmentTrainingStats) => e.name)
);

const createEquipmentLink = (publicUrl: string, equipment: Equipment) =>
  new URL(`${publicUrl}/equipment/${equipment.id}`);

const gatherEmailContentForEquipment =
  (deps: TrainingSummaryDeps) =>
  async (
    equipment: Equipment,
    totalActiveMembers: number
  ): Promise<EquipmentTrainingStats> => {
    const qzResults = O.isNone(equipment.trainingSheetId)
      ? E.left('No training sheet registered')
      : await getFullQuizResults(
          deps,
          equipment.trainingSheetId.value,
          equipment
        )();

    let awaitingTraining: O.Option<number> = O.none;
    if (E.isLeft(qzResults)) {
      deps.logger.warn(
        'Failed to get members awaiting training for email content: %s',
        qzResults.left
      );
    } else {
      awaitingTraining = O.some(qzResults.right.membersAwaitingTraining.length);
    }

    const equipmentLink = createEquipmentLink(deps.conf.PUBLIC_URL, equipment);

    return {
      name: sanitizeString(equipment.name),
      awaitingTraining,
      trainedTotal: equipment.trainedMembers.length,
      trainedLast30Days: equipment.trainedMembers.filter(
        member =>
          DateTime.fromJSDate(member.trainedSince).diffNow() <
          Duration.fromObject({days: 30})
      ).length,
      equipmentLink,
      trainerCount: equipment.trainers.length,
      percentageOfActiveMembershipTrained:
        totalActiveMembers > 0
          ? Math.round(equipment.trainedMembers.length / totalActiveMembers)
          : 0,
    };
  };

const gatherEmailContent = async (
  deps: TrainingSummaryDeps
): Promise<EmailContent> => {
  const result = [];
  const members = deps.sharedReadModel.members.getAll();
  const totalActiveMembers = members.reduce(
    (total, member) => (member.status === 'active' ? total + 1 : total),
    0
  );
  const cutoff30Days =
    new Date().getTime() - Duration.fromObject({days: 30}).as('milliseconds');
  const membersJoinedWithin30Days = members.filter(
    member => member.joined.getTime() > cutoff30Days
  ).length;
  for (const equipment of deps.sharedReadModel.equipment.getAll()) {
    // Sequential gather as we can afford to be slower.
    result.push(
      await gatherEmailContentForEquipment(deps)(equipment, totalActiveMembers)
    );
  }
  return {
    trainingStatsPerEquipment: RA.sortBy([byName])(result),
    totalActiveMembers,
    membersJoinedWithin30Days,
  };
};

const generateTrainingSummaryEmail = (
  emailAddress: EmailAddress,
  content: EmailContent
): Email => ({
  recipient: emailAddress,
  subject: 'Makespace Training Stats',
  text: `
      Hi,

      Here are the latest training stats for makespace.
      Thank you for voluneering to be an owner at makespace!
    `,
  html: mjml2html(`
    <mjml>
  <mj-body width="800px">
    <mj-section background-color="#fa990e">
      <mj-column>
        <mj-text align="center" color="#111" font-size="40px">MakeSpace Training Update</mj-text>
      </mj-column>
    </mj-section>
    <mj-section>
      <mj-column width="800px">
        <mj-text align="left" color="#111" font-size="12px">
          Hi,
        </mj-text>
        <mj-text align="left" color="#111" font-size="12px">
          Here are the latest training stats for makespace. Thank you for voluneering to be an owner at makespace!
        </mj-text>
        <mj-text align="left" color="#111" font-size="12px">
          You are receiving this email because you opted in - contact 'database-owners@makespace.org' if you would like to opt out.
        </mj-text>
        <mj-text align="left" color="#111" font-size="12px">
          Current members: ${content.totalActiveMembers} (+${content.membersJoinedWithin30Days} in last 30 days)
        </mj-text>

        <mj-table>
          <tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0;">
            <th style="padding: 0 0 0 0">Equipment</th>
            <th style="padding: 0 0 0 0">Waiting for Training</th>
            <th style="padding: 0 0 0 0">Trained in last 30 days</th>
            <th style="padding: 0 0 0 0">Trained total</th>
            <th style="padding: 0 0 0 0">% of membership trained</th>
            <th style="padding: 0 0 0 0">Quick Link</th>
          </tr>
          ${content.trainingStatsPerEquipment
            .map(
              stats =>
                `
              <tr>
                <th>${stats.name}</th>
                <th>${O.getOrElse<string | number>(() => '-')(stats.awaitingTraining)}</th>
                <th>${stats.trainedLast30Days}</th>
                <th>${stats.trainedTotal}</th>
                <th>${stats.percentageOfActiveMembershipTrained}%</th>
                <th><a href="${stats.equipmentLink.href}">Link</a></th>
              </tr>
              `
            )
            .join('\n')}
        </mj-table>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
    `).html,
});

const decideOwnersToEmail =
  (deps: TrainingSummaryDeps) =>
  async (allOwners: ReadonlyArray<Owner>): Promise<ReadonlyArray<Owner>> => {
    // Decides owners to email based on when we last sent an email.
    const ownersToEmail = [];
    for (const owner of allOwners) {
      if (!TRAINING_SUMMARY_EMAIL_ALLOWLIST.includes(owner.memberNumber)) {
        continue;
      }
      // TODO - Make this more efficient by avoiding as many db calls.
      const lastEmailSent =
        await readModels.trainingStatNotifications.getLastNotificationSent(
          deps
        )(owner.memberNumber)();
      if (E.isLeft(lastEmailSent)) {
        deps.logger.error(
          "Failed to get last notification sent for owner %s - skipping: '%s'",
          owner.memberNumber,
          lastEmailSent.left.message
        );
        continue;
      }

      if (
        O.isSome(lastEmailSent.right.lastNotification) &&
        lastEmailSent.right.lastNotification.value.diffNow().negate() <
          TRAINING_SUMMARY_EMAIL_INTERVAL
      ) {
        deps.logger.info(
          'Checked for training summary sync for %s - last sync %s was recent (%s) - skipping.',
          owner.memberNumber,
          lastEmailSent.right.lastNotification.value.toISO(),
          lastEmailSent.right.lastNotification.value.diffNow().toHuman()
        );
        continue;
      }

      // Initial simple version - we mark the email as sent before we send it. If this fails
      // (perhaps because something else sent an email in the meantime) we don't send the email.
      const emailSentEventResp = await deps.commitEvent(
        lastEmailSent.right.resource,
        lastEmailSent.right.resourceVersion
      )(
        constructEvent('TrainingStatNotificationSent')({
          actor: {
            tag: 'system',
          },
          toMemberNumber: owner.memberNumber,
          toMemberEmail: owner.emailAddress,
        })
      )();
      if (E.isLeft(emailSentEventResp)) {
        deps.logger.warn(
          "Failed to commit training summary email sent event for %s: '%s' - not sending email",
          owner.memberNumber,
          emailSentEventResp.left
        );
        continue;
      }
      // If we now fail the actually send the email we log it but don't do anything further. This
      // prevents double emails at the risk of potential missed emails.
      ownersToEmail.push(owner);
    }
    return ownersToEmail;
  };

export const trainingSummaryEmail = async (deps: TrainingSummaryDeps) => {
  deps.logger.info(
    'Running training summary email sync, deciding owners to email...'
  );

  const ownersToEmail = await pipe(
    deps.sharedReadModel.area.getAll(),
    RA.flatMap(a => a.owners),
    decideOwnersToEmail(deps)
  );

  if (ownersToEmail.length < 1) {
    deps.logger.info('No owners to email');
    return;
  }
  deps.logger.info(
    'Got %s owners to email, generating email content...',
    ownersToEmail.length
  );
  const content = await gatherEmailContent(deps);
  deps.logger.info('Email content: %o', content);
  for (const owner of ownersToEmail) {
    const logger = deps.logger.child({
      owner_membership_number: owner.memberNumber,
      owner_email: owner.emailAddress,
    });
    logger.info('Generating email body...');
    const email = generateTrainingSummaryEmail(owner.emailAddress, content);
    logger.info('Sending email...');
    const sentEmailResp = await deps.sendEmail(email)();
    if (E.isLeft(sentEmailResp)) {
      logger.error(
        "Failed to send training summary email: '%s' - skipped",
        sentEmailResp.left
      );
      continue;
    }
    logger.info('Successfully sent training summary email');
  }
};
