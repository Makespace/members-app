import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import {EmailContent} from '../../../src/sync-worker/training-summary/gather-email-content';
import {generateTrainingSummaryEmail} from '../../../src/sync-worker/training-summary/training_summary_email';
import {EmailAddress} from '../../../src/types/email-address';
import {sanitizeString} from '../../../src/types/html';

describe('Training summary email rendering', () => {
  const emailAddress = faker.internet.email() as EmailAddress;

  // Every numeric cell gets a distinct value, so an assertion on a rendered
  // cell can only match the column it names. Two equipment rows with open
  // counts 2 and 5 give a total (7) that matches no single row.
  const content = (): EmailContent => ({
    trainingStatsPerEquipment: [
      {
        name: sanitizeString('Fine Metals Bench'),
        awaitingTraining: O.some(3),
        trainedTotal: 13,
        trainedLast30Days: 11,
        openTroubleTickets: 2,
        equipmentLink: new URL('https://localhost/equipment/fine-metals-bench'),
        trainerCount: 2,
        percentageOfActiveMembershipTrained: 10,
      },
      {
        name: sanitizeString('Wood Lathe'),
        awaitingTraining: O.none,
        trainedTotal: 15,
        trainedLast30Days: 4,
        openTroubleTickets: 5,
        equipmentLink: new URL('https://localhost/equipment/wood-lathe'),
        trainerCount: 2,
        percentageOfActiveMembershipTrained: 12,
      },
    ],
    totalActiveMembers: 100,
    totalTrainingsLast30Days: 6,
    totalTrainings: 28,
    totalOpenTroubleTickets: 7,
    membersJoinedWithin30Days: 8,
  });

  it('includes an Open Trouble Tickets column', () => {
    expect(generateTrainingSummaryEmail(emailAddress, content()).html).toContain(
      'Open Trouble Tickets'
    );
  });

  it('renders each per-equipment count in its row and the sum in the Total row', () => {
    const html = generateTrainingSummaryEmail(emailAddress, content()).html;
    const renderedCells = (value: number) =>
      html.match(new RegExp(`>${value}</th>`, 'g')) ?? [];
    expect(renderedCells(2)).toHaveLength(1);
    expect(renderedCells(5)).toHaveLength(1);
    // The total appears only in the Total row - wiring it to any single
    // row's count (or any other column's total) would fail this.
    expect(renderedCells(7)).toHaveLength(1);
  });
});
