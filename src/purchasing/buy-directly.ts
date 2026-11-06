import * as E from 'fp-ts/Either';
import {Classification} from './classify-purchase';

// Super users and a purchasing area's purchasers can make a purchase
// themselves (e.g. with Capital on Tap) instead of sending a request for a
// director to approve. It is then recorded as bought, and counts against the
// budget straight away.
export type BuyerRole = 'super-user' | 'purchaser' | 'neither';

export const NEEDS_APPROVAL =
  'Your purchase request will have to be approved by a Purchaser for this Purchasing Area, or by a director.';

// Shared by the form (and mirrored by its script) and the submit command, so
// they refuse the same things with the same messages.
export const canBuyDirectly = (
  role: BuyerRole,
  {
    amountPence,
    smallPurchaseAmountPence,
    affectedAreaNames,
    healthAndSafetyRisk,
    classification,
  }: {
    amountPence: number;
    // The purchasing area's: see classifyPurchase.
    smallPurchaseAmountPence: number;
    affectedAreaNames: ReadonlyArray<string>;
    healthAndSafetyRisk: boolean;
    classification: Pick<Classification, 'approval' | 'outcome'>;
  }
): E.Either<string, true> => {
  if (role === 'neither') {
    return E.left(NEEDS_APPROVAL);
  }
  // Other areas' owners need their say, and a risk needs assessing, whoever
  // is buying it.
  if (affectedAreaNames.length > 0 || healthAndSafetyRisk) {
    return E.left(
      "Purchases that affect other areas or carry a health and safety risk need a proposal, so they can't be bought directly."
    );
  }
  // A repair needing a super user's approval needs one to buy it too. A
  // repair a purchaser could approve, they can buy, whatever the small
  // purchase amount.
  if (classification.outcome === 'repair') {
    return role === 'purchaser' && classification.approval !== 'none'
      ? E.left(
          "This repair needs a super user's approval, so a purchaser can't buy it directly. Send it as a request for a super user to approve."
        )
      : E.right(true);
  }
  // Only a super user can go ahead with one that would otherwise need a
  // proposal for its cost (the small purchase amount or more, or over the
  // budget). The small purchase amount holds for purchasers even when members
  // pay for it.
  if (
    role === 'purchaser' &&
    (classification.approval === 'proposal' ||
      amountPence >= smallPurchaseAmountPence)
  ) {
    return E.left(
      "This needs a proposal, so a purchaser can't buy it directly. Send it as a request for a director to approve."
    );
  }
  return E.right(true);
};
