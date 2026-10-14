import {
  membershipGap,
  SubscriptionSummary,
} from '../../../src/read-models/external-state/membership-gap';

const now = new Date('2026-10-05T12:00:00.000Z');

const subscription = (
  overrides: Partial<SubscriptionSummary>
): SubscriptionSummary => ({
  id: 'sub',
  email: 'member@example.com',
  planCode: 'standard',
  state: 'expired',
  startedAt: null,
  endedAt: null,
  ...overrides,
});

const expired = (startedAt: string, endedAt: string) =>
  subscription({
    id: `expired-${endedAt}`,
    state: 'expired',
    startedAt: new Date(startedAt),
    endedAt: new Date(endedAt),
  });

const active = (startedAt: string) =>
  subscription({
    id: `active-${startedAt}`,
    state: 'active',
    startedAt: new Date(startedAt),
  });

describe('membershipGap', () => {
  it('knows nothing with no subscriptions', () => {
    expect(membershipGap([], now)).toStrictEqual({tag: 'no-data'});
  });

  it('measures the gap from the old membership ending to the new one starting', () => {
    expect(
      membershipGap(
        [active('2026-09-28'), expired('2022-01-10', '2024-11-14')],
        now
      )
    ).toStrictEqual({
      tag: 'known',
      previousEndedAt: new Date('2024-11-14'),
      currentStartedAt: new Date('2026-09-28'),
      monthsAway: 22,
      lapsed: true,
    });
  });

  it('does not count a short break as lapsed', () => {
    expect(
      membershipGap(
        [active('2026-09-28'), expired('2022-01-10', '2026-05-01')],
        now
      )
    ).toMatchObject({tag: 'known', monthsAway: 4, lapsed: false});
  });

  it('treats exactly the threshold as lapsed', () => {
    expect(
      membershipGap(
        [active('2026-09-28'), expired('2022-01-10', '2026-03-28')],
        now
      )
    ).toMatchObject({tag: 'known', monthsAway: 6, lapsed: true});
  });

  it('uses the most recent ending before the current membership', () => {
    expect(
      membershipGap(
        [
          active('2026-09-28'),
          expired('2019-01-01', '2020-06-01'),
          expired('2021-01-01', '2024-11-14'),
        ],
        now
      )
    ).toMatchObject({tag: 'known', previousEndedAt: new Date('2024-11-14')});
  });

  it('ignores something that ended after they came back, such as a locker', () => {
    expect(
      membershipGap(
        [
          active('2026-09-28'),
          expired('2021-01-01', '2024-11-14'),
          subscription({
            id: 'locker',
            planCode: 'locker',
            state: 'expired',
            startedAt: new Date('2026-09-28'),
            endedAt: new Date('2026-10-01'),
          }),
        ],
        now
      )
    ).toMatchObject({tag: 'known', previousEndedAt: new Date('2024-11-14')});
  });

  it('counts a cancelled-but-still-paid subscription as live', () => {
    expect(
      membershipGap(
        [
          subscription({
            id: 'cancelled',
            state: 'canceled',
            startedAt: new Date('2026-09-28'),
          }),
          expired('2021-01-01', '2024-11-14'),
        ],
        now
      )
    ).toMatchObject({tag: 'known', currentStartedAt: new Date('2026-09-28')});
  });

  it('gives the gap so far when nothing is live yet', () => {
    expect(
      membershipGap([expired('2021-01-01', '2026-07-05')], now)
    ).toStrictEqual({
      tag: 'no-current',
      previousEndedAt: new Date('2026-07-05'),
      monthsAway: 3,
      lapsed: false,
    });
  });

  it('settles a gap so far that is already over the threshold', () => {
    expect(
      membershipGap([expired('2021-01-01', '2024-11-14')], now)
    ).toMatchObject({tag: 'no-current', lapsed: true});
  });

  it('says so when something is live but nothing ever ended', () => {
    expect(membershipGap([active('2022-01-10')], now)).toStrictEqual({
      tag: 'no-previous',
      currentStartedAt: new Date('2022-01-10'),
    });
  });
});
