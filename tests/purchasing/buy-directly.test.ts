import * as E from 'fp-ts/Either';
import {canBuyDirectly, NEEDS_APPROVAL} from '../../src/purchasing/buy-directly';

describe('canBuyDirectly', () => {
  const plain = {
    amountPence: 5_000,
    affectedAreaNames: [],
    healthAndSafetyRisk: false,
    classification: {approval: 'none' as const},
  };
  const needingProposal = {...plain, classification: {approval: 'proposal' as const}};

  it('lets a purchaser or super user buy what needs no proposal', () => {
    expect(canBuyDirectly('purchaser', plain)).toStrictEqual(E.right(true));
    expect(canBuyDirectly('super-user', plain)).toStrictEqual(E.right(true));
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
