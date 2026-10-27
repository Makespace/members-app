import {lastSummaryBoundary} from '../../src/recurly-monitor/activity';

describe('lastSummaryBoundary', () => {
  describe('in winter (GMT)', () => {
    it('is this Monday at 09:00 once that has passed', () => {
      expect(lastSummaryBoundary(new Date('2026-11-09T09:00:00.000Z'))).toStrictEqual(
        new Date('2026-11-09T09:00:00.000Z')
      );
    });

    it('is the previous Monday until then', () => {
      expect(lastSummaryBoundary(new Date('2026-11-09T08:59:59.000Z'))).toStrictEqual(
        new Date('2026-11-02T09:00:00.000Z')
      );
    });

    it('is the most recent Monday later in the week', () => {
      expect(lastSummaryBoundary(new Date('2026-11-13T18:00:00.000Z'))).toStrictEqual(
        new Date('2026-11-09T09:00:00.000Z')
      );
    });
  });

  describe('in summer (BST)', () => {
    it('is 09:00 UK time, which is 08:00 UTC', () => {
      expect(lastSummaryBoundary(new Date('2026-10-19T08:30:00.000Z'))).toStrictEqual(
        new Date('2026-10-19T08:00:00.000Z')
      );
    });
  });
});
