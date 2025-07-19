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

// Temporary
// const TRAINING_SUMMARY_EMAIL_ALLOWLIST: number[] = [1741, 131, 1698, 1725];
const TRAINING_SUMMARY_EMAIL_ALLOWLIST: number[] = [1741];
const TRAINING_SUMMARY_EMAIL_INTERVAL: Duration = Duration.fromObject({
  week: 1,
});

type TrainingSummaryDeps = Pick<
  SyncWorkerDependencies,
  | 'sendEmail'
  | 'sharedReadModel'
  | 'logger'
  | 'commitEvent'
  | 'lastQuizSync'
  | 'getSheetData'
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
};

type EmailContent = {
  trainingStatsPerEquipment: ReadonlyArray<EquipmentTrainingStats>;
};

const byName = pipe(
  S.Ord,
  contramap((e: EquipmentTrainingStats) => e.name)
);

const createEquipmentLink = (publicUrl: string, equipment: Equipment) =>
  new URL(`${publicUrl}/equipment/${equipment.id}`);

const gatherEmailContentForEquipment =
  (deps: TrainingSummaryDeps) =>
  async (equipment: Equipment): Promise<EquipmentTrainingStats> => {
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
    };
  };

const gatherEmailContent = async (
  deps: TrainingSummaryDeps
): Promise<EmailContent> => {
  const result = [];
  for (const equipment of deps.sharedReadModel.equipment.getAll()) {
    // Sequential gather as we can afford to be slower.
    result.push(await gatherEmailContentForEquipment(deps)(equipment));
  }
  return {
    trainingStatsPerEquipment: RA.sortBy([byName])(result),
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

      Here are the latest training stats for makespace:

      ${content.trainingStatsPerEquipment
        .map(
          stats =>
            `${stats.name}: Waiting for training: ${O.getOrElse<string | number>(() => 'unknown')(stats.awaitingTraining)} Trained in last 30 days: ${stats.trainedLast30Days} Trained total: ${stats.trainedTotal} Registered Trainers: ${stats.trainerCount}`
        )
        .join('\n')}
    
      Thank you for voluneering to be an owner at makespace!
    `,
  html: mjml2html(`
    <mjml>
  <mj-body width="800px">
    <mj-section background-color="#fa990e">
      <mj-column>
        <mj-text align="center" color="#111" font-size="40px">MakeSpace</mj-text>
        <mj-text font-style="italic" align="center" color="#111" font-size="30px">Member App</mj-text>
      </mj-column>
    </mj-section>
    <mj-section>
      <mj-column width="400px">
        <mj-text font-size="20px" line-height="1.3" color="#111" align="center">Makespace training stats
        </mj-text>
        ${content.trainingStatsPerEquipment
          .map(
            stats =>
              `
                <mj-text color="#111">
                    ${stats.name}: Waiting for training: ${O.getOrElse<string | number>(() => 'unknown')(stats.awaitingTraining)} Trained in last 30 days: ${stats.trainedLast30Days} Trained total: ${stats.trainedTotal}
                </mj-text>
                <mj-button color="#111" background-color="#7FC436" href="${stats.equipmentLink.href}" font-weight="800">${stats.equipmentLink.href}</mj-button>
              `
          )
          .join('\n')}
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
    // Also includes a concurrency check to make sure we have the latest information on when the last email was sent.
    const ownersToEmail = [];
    for (const owner of allOwners) {
      if (!TRAINING_SUMMARY_EMAIL_ALLOWLIST.includes(owner.memberNumber)) {
        continue;
      }
      const notifSettings =
        deps.sharedReadModel.trainingStats.getNotificationSettings(
          owner.memberNumber
        );
      if (
        O.isSome(notifSettings.lastEmailSent) &&
        notifSettings.lastEmailSent.value.diffNow() <
          TRAINING_SUMMARY_EMAIL_INTERVAL
      ) {
        deps.logger.info(
          'Checked for training summary sync for %s - last sync %s was recent - skipping.',
          owner.memberNumber,
          notifSettings.lastEmailSent.value.toISO()
        );
        continue;
      }

      // Initial simple version - we mark the email as sent before we send it. If this fails
      // (perhaps because something else sent an email in the meantime) we don't send the email.
      const emailSentEventResp = await deps.commitEvent(
        notifSettings.resource.res,
        notifSettings.resource.version
      )(
        constructEvent('TrainerTrainingSummarySent')({
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
