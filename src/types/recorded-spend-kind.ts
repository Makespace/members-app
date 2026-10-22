import * as t from 'io-ts';

// Whether spending a super user records against a purchasing area comes out
// of its yearly budget, or is approved spending outside it - e.g. £1,000 the
// directors approved to fix the extraction. (Spending members pay for, such
// as filament on SumUp, isn't recorded this way at all.)
export const RecordedSpendKindCodec = t.keyof({
  budget: null,
  approved: null,
});

export type RecordedSpendKind = t.TypeOf<typeof RecordedSpendKindCodec>;
