// Where a purchase request has got to. A request waits for a super user (in
// effect, the directors) to approve or decline it, unless a super user or the
// area's purchaser bought it directly. Approved and directly bought ones
// count against a purchasing area's budget.
export type PurchaseRequestStatus =
  | 'awaiting-approval'
  | 'approved'
  // Approved, then bought by a purchaser or super user.
  | 'bought'
  | 'declined'
  | 'bought-directly';
