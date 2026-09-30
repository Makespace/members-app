import * as O from 'fp-ts/Option';
import {bandFor} from '../../../src/queries/outstanding-invoices/view-model';

// The thresholds trustees actually set; the defaults, here.
const thresholds = {removeAccessAfterDays: 14, cancelAfterDays: 60};

describe('which band somebody in arrears falls into', () => {
  it('watches somebody only just behind', () => {
    expect(bandFor(O.some(1), thresholds)).toBe('watch');
    expect(bandFor(O.some(13), thresholds)).toBe('watch');
  });

  it('crosses into removing access on the fourteenth day, not the thirteenth', () => {
    expect(bandFor(O.some(13), thresholds)).toBe('watch');
    expect(bandFor(O.some(14), thresholds)).toBe('remove-access');
  });

  it('crosses into cancelling on the sixtieth day, not the fifty-ninth', () => {
    expect(bandFor(O.some(59), thresholds)).toBe('remove-access');
    expect(bandFor(O.some(60), thresholds)).toBe('cancel');
  });

  it('treats an unknown number of days as the mildest case', () => {
    // An invoice with no due date tells us nothing; it should not put somebody
    // in front of a decision to cancel their membership.
    expect(bandFor(O.none, thresholds)).toBe('watch');
  });

  it('follows the configured thresholds rather than the defaults', () => {
    const strict = {removeAccessAfterDays: 7, cancelAfterDays: 30};
    expect(bandFor(O.some(7), strict)).toBe('remove-access');
    expect(bandFor(O.some(30), strict)).toBe('cancel');
    expect(bandFor(O.some(29), strict)).toBe('remove-access');
  });
});
