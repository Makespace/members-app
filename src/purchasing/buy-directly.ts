import * as E from 'fp-ts/Either';
import {Classification, PROPOSAL_THRESHOLD_PENCE} from './classify-purchase';

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
    affectedAreaNames,
    healthAndSafetyRisk,
    classification,
  }: {
    amountPence: number;
    affectedAreaNames: ReadonlyArray<string>;
    healthAndSafetyRisk: boolean;
    classification: Pick<Classification, 'approval'>;
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
  // Only a super user can go ahead with one that would otherwise need a
  // proposal for its cost (£1,000 or more, or over the budget). The £1,000
  // limit holds for purchasers even when members pay for it.
  if (
    role === 'purchaser' &&
    (classification.approval === 'proposal' ||
      amountPence >= PROPOSAL_THRESHOLD_PENCE)
  ) {
    return E.left(
      "This needs a proposal, so a purchaser can't buy it directly. Send it as a request for a director to approve."
    );
  }
  return E.right(true);
};
