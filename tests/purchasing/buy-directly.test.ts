import * as E from 'fp-ts/Either';
import {canBuyDirectly, NEEDS_APPROVAL} from '../../src/purchasing/buy-directly';

describe('canBuyDirectly', () => {
  const plain = {
    amountPence: 5_000,
    smallPurchaseAmountPence: 100_000,
    affectedAreaNames: [],
    healthAndSafetyRisk: false,
    classification: {approval: 'none' as const, outcome: 'budget' as const},
  };
  const needingProposal = {...plain, classification: {approval: 'proposal' as const, outcome: 'budget-proposal-needed' as const}};

  it('lets a purchaser or super user buy what needs no proposal', () => {
    expect(canBuyDirectly('purchaser', plain)).toStrictEqual(E.right(true));
    expect(canBuyDirectly('super-user', plain)).toStrictEqual(E.right(true));
  });

  it("stops a purchaser buying at or over the purchasing area's small purchase amount", () => {
    const atAmount = {...plain, amountPence: 50_000, smallPurchaseAmountPence: 50_000};
    expect(E.isLeft(canBuyDirectly('purchaser', atAmount))).toBe(true);
    expect(
      canBuyDirectly('purchaser', {...atAmount, amountPence: 49_999})
    ).toStrictEqual(E.right(true));
  });

  it('leaves anyone else to send a request for approval', () => {
    expect(canBuyDirectly('neither', plain)).toStrictEqual(E.left(NEEDS_APPROVAL));
  });

  it('lets only a super user buy what would need a proposal for its cost', () => {
    expect(E.isLeft(canBuyDirectly('purchaser', needingProposal))).toBe(true);
    expect(canBuyDirectly('super-user', needingProposal)).toStrictEqual(
      E.right(true)
    );
  });

  it("holds a purchaser to the £1,000 limit even when members pay for it", () => {
    const pricey = {...plain, amountPence: 100_000};
    expect(E.isLeft(canBuyDirectly('purchaser', pricey))).toBe(true);
    expect(canBuyDirectly('super-user', pricey)).toStrictEqual(E.right(true));
  });

  it('lets nobody buy what affects other areas or carries a risk', () => {
    for (const role of ['purchaser', 'super-user'] as const) {
      expect(
        E.isLeft(
          canBuyDirectly(role, {...needingProposal, affectedAreaNames: ['Metal Shop']})
        )
      ).toBe(true);
      expect(
        E.isLeft(canBuyDirectly(role, {...needingProposal, healthAndSafetyRisk: true}))
      ).toBe(true);
    }
  });
});

describe('canBuyDirectly for repairs', () => {
  const repair = (approval: 'none' | 'super-user') => ({
    amountPence: 120_000,
    smallPurchaseAmountPence: 100_000,
    affectedAreaNames: [],
    healthAndSafetyRisk: false,
    classification: {approval, outcome: 'repair' as const},
  });

  it('lets a purchaser buy a repair they could approve, even over the small purchase amount', () => {
    expect(canBuyDirectly('purchaser', repair('none'))).toStrictEqual(E.right(true));
  });

  it("lets only a super user buy one needing a super user's approval", () => {
    expect(E.isLeft(canBuyDirectly('purchaser', repair('super-user')))).toBe(true);
    expect(canBuyDirectly('super-user', repair('super-user'))).toStrictEqual(
      E.right(true)
    );
  });
});
