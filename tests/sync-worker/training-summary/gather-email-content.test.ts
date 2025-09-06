import * as TE from 'fp-ts/TaskEither';

import {
  EmailContent,
  gatherEmailContent,
} from '../../../src/sync-worker/training-summary/gather-email-content';
import {TrainingSummaryDeps} from '../../../src/sync-worker/training-summary/training-summary-deps';
import {happyPathAdapters} from '../../init-dependencies/happy-path-adapters.helper';

import {NonEmptyString} from 'io-ts-types';

describe('Training summary', () => {
  let deps: TrainingSummaryDeps;
  beforeEach(() => {
    deps = {
      ...happyPathAdapters,
      sendEmail: jest.fn(() => TE.right('success')),
      conf: {
        PUBLIC_URL: 'https://localhost' as NonEmptyString,
      },
    };
  });
  describe('Gather email content', () => {
    describe('The database is empty', () => {
      let content: EmailContent;
      beforeEach(async () => {
        content = await gatherEmailContent(deps);
      });

      it('members joined within 30 days to be 0', () => {
        expect(content.membersJoinedWithin30Days).toStrictEqual(0);
      });
      it('total active members to be 0', () => {
        expect(content.totalActiveMembers).toStrictEqual(0);
      });
      it('there is no equipment', () => {
        expect(content.trainingStatsPerEquipment).toHaveLength(0);
      });
    });
  });
});
