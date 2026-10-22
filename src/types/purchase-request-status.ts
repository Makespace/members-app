// Where a purchase request has got to. Every request waits for a super user
// (in effect, the directors) to approve or decline it; only approved ones
// count against a purchasing area's budget.
export type PurchaseRequestStatus = 'awaiting-approval' | 'approved' | 'declined';
