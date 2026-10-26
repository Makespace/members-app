import jwt from 'jsonwebtoken';
import {Config} from '../../src/configuration';
import {
  createFormToken,
  FORM_TOKEN_FIELD,
  HONEYPOT_FIELD,
  publicReportGuard,
} from '../../src/trouble-tickets/public-report-guard';

const conf = {TOKEN_SECRET: 'test-token-secret'} as unknown as Config;

describe('the checks on a report from somebody not logged in', () => {
  const shownAt = new Date('2026-10-26T10:00:00Z');
  const later = (seconds: number) =>
    new Date(shownAt.getTime() + seconds * 1000);

  const body = (overrides: Record<string, unknown> = {}) => ({
    [FORM_TOKEN_FIELD]: createFormToken(conf, shownAt),
    [HONEYPOT_FIELD]: '',
    issue: 'Blade stalls',
    ...overrides,
  });

  it('lets a person through', () => {
    const guard = publicReportGuard(conf);
    expect(guard(body(), '1.2.3.4', later(30)).tag).toStrictEqual('accept');
  });

  // A bot is not told why: it would only learn to stop doing it.
  it('quietly drops a report with the hidden field filled in', () => {
    const guard = publicReportGuard(conf);
    expect(
      guard(body({[HONEYPOT_FIELD]: 'https://spam.example'}), '1.2.3.4', later(30))
        .tag
    ).toStrictEqual('drop');
  });

  it('refuses a post that did not come from the form', () => {
    const guard = publicReportGuard(conf);
    expect(
      guard(body({[FORM_TOKEN_FIELD]: undefined}), '1.2.3.4', later(30)).tag
    ).toStrictEqual('refuse');
  });

  it('refuses a form we did not hand out', () => {
    const guard = publicReportGuard(conf);
    const forged = jwt.sign(
      {purpose: 'PublicTroubleTicketForm', issuedAt: shownAt.getTime()},
      'some other secret'
    );
    expect(
      guard(body({[FORM_TOKEN_FIELD]: forged}), '1.2.3.4', later(30)).tag
    ).toStrictEqual('refuse');
  });

  it('refuses a report sent faster than anybody could fill it in', () => {
    const guard = publicReportGuard(conf);
    expect(guard(body(), '1.2.3.4', later(1)).tag).toStrictEqual('refuse');
  });

  it('limits how many reports come from one place in an hour', () => {
    const guard = publicReportGuard(conf, {
      perClientPerHour: 2,
      overallPerHour: 100,
    });
    const verdicts = [30, 40, 50].map(
      seconds => guard(body(), '1.2.3.4', later(seconds)).tag
    );
    expect(verdicts).toStrictEqual(['accept', 'accept', 'refuse']);
    // Somebody elsewhere is unaffected.
    expect(guard(body(), '5.6.7.8', later(60)).tag).toStrictEqual('accept');
    // And an hour on, the first place may report again.
    expect(guard(body(), '1.2.3.4', later(60 * 60 + 31)).tag).toStrictEqual(
      'accept'
    );
  });

  describe('from Makespace itself', () => {
    const atTheSpace = {
      ...conf,
      MAKESPACE_NETWORK_ADDRESSES: '62.30.18.106, 2a02:8010:abcd::/48',
    } as unknown as Config;
    const strict = {perClientPerHour: 1, overallPerHour: 1};

    // Everybody on the space's wifi shares its address.
    it('is never rate limited', () => {
      const guard = publicReportGuard(atTheSpace, strict);
      const verdicts = [30, 40, 50].map(
        seconds => guard(body(), '62.30.18.106', later(seconds)).tag
      );
      expect(verdicts).toStrictEqual(['accept', 'accept', 'accept']);
    });

    it('takes a range of addresses', () => {
      const guard = publicReportGuard(atTheSpace, strict);
      const verdicts = [30, 40].map(
        seconds => guard(body(), '2a02:8010:abcd::17', later(seconds)).tag
      );
      expect(verdicts).toStrictEqual(['accept', 'accept']);
    });

    it('does not use up the limit for everybody else', () => {
      const guard = publicReportGuard(atTheSpace, strict);
      guard(body(), '62.30.18.106', later(30));
      expect(guard(body(), '1.2.3.4', later(40)).tag).toStrictEqual('accept');
    });

    // These cost a person nothing, and still catch a misbehaving device on
    // the space's network.
    it('still drops a report with the hidden field filled in', () => {
      const guard = publicReportGuard(atTheSpace, strict);
      expect(
        guard(body({[HONEYPOT_FIELD]: 'x'}), '62.30.18.106', later(30)).tag
      ).toStrictEqual('drop');
    });

    it('still refuses a post that did not come from the form', () => {
      const guard = publicReportGuard(atTheSpace, strict);
      expect(
        guard(body({[FORM_TOKEN_FIELD]: ''}), '62.30.18.106', later(30)).tag
      ).toStrictEqual('refuse');
    });
  });

  it('limits how many reports come in altogether', () => {
    const guard = publicReportGuard(conf, {
      perClientPerHour: 100,
      overallPerHour: 2,
    });
    const verdicts = ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map(
      ip => guard(body(), ip, later(30)).tag
    );
    expect(verdicts).toStrictEqual(['accept', 'accept', 'refuse']);
  });
});
