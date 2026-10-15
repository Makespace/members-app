import {
  classifyPurchase,
  PROPOSAL_THRESHOLD_PENCE,
} from '../../src/purchasing/classify-purchase';

const roomyBudget = {
  yearlyBudgetPence: 500_000,
  spentThisYearPence: 0,
};

describe('classifyPurchase', () => {
  it('treats £1,000 as the proposal threshold', () => {
    expect(PROPOSAL_THRESHOLD_PENCE).toStrictEqual(100_000);
  });

  describe('when it is a consumable members pay for at point of use', () => {
    const result = classifyPurchase({
      isMemberPaidConsumable: true,
      amountPence: 250_000,
      yearlyBudgetPence: 0,
      spentThisYearPence: 0,
    });

    it('is a consumable, however much it costs and whatever the budget', () => {
      expect(result.outcome).toStrictEqual('consumable');
    });

    it('needs no approval', () => {
      expect(result.approval).toStrictEqual('none');
    });

    it('explains that it does not use the budget', () => {
      expect(result.reason).toContain("doesn't come out of the yearly budget");
    });
  });

  describe('when it is not a consumable', () => {
    describe('and comfortably within the budget', () => {
      const result = classifyPurchase({
        isMemberPaidConsumable: false,
        amountPence: 25_000,
        yearlyBudgetPence: 150_000,
        spentThisYearPence: 50_000,
      });

      it('comes from the yearly budget', () => {
        expect(result.outcome).toStrictEqual('budget');
      });

      it('needs no approval', () => {
        expect(result.approval).toStrictEqual('none');
      });

      it('says what is left afterwards', () => {
        expect(result.reason).toContain('£750.00');
        expect(result.reason).toContain('£1,500.00');
      });
    });

    describe('and repairing something costs £630', () => {
      it('comes from the yearly budget too', () => {
        const result = classifyPurchase({
          isMemberPaidConsumable: false,
          amountPence: 63_000,
          ...roomyBudget,
        });
        expect(result.outcome).toStrictEqual('budget');
      });
    });

    describe('and exactly £1,000 in a single purchase', () => {
      it('needs a proposal', () => {
        const result = classifyPurchase({
          isMemberPaidConsumable: false,
          amountPence: 100_000,
          ...roomyBudget,
        });
        expect(result.outcome).toStrictEqual('budget-proposal-needed');
        expect(result.approval).toStrictEqual('proposal');
        expect(result.reason).toContain('£1,000.00 or more');
      });
    });

    describe('and a penny under £1,000 with budget to spare', () => {
      it('comes from the yearly budget', () => {
        const result = classifyPurchase({
          isMemberPaidConsumable: false,
          amountPence: 99_999,
          ...roomyBudget,
        });
        expect(result.outcome).toStrictEqual('budget');
      });
    });

    describe('and over £1,000', () => {
      it('needs a proposal even with budget to spare', () => {
        const result = classifyPurchase({
          isMemberPaidConsumable: false,
          amountPence: 250_000,
          yearlyBudgetPence: 1_000_000,
          spentThisYearPence: 0,
        });
        expect(result.outcome).toStrictEqual('budget-proposal-needed');
      });
    });

    describe('and it lands exactly on the budget', () => {
      it('comes from the yearly budget, leaving nothing', () => {
        const result = classifyPurchase({
          isMemberPaidConsumable: false,
          amountPence: 30_000,
          yearlyBudgetPence: 100_000,
          spentThisYearPence: 70_000,
        });
        expect(result.outcome).toStrictEqual('budget');
        expect(result.approval).toStrictEqual('none');
        expect(result.reason).toContain('leaving £0.00');
      });
    });

    describe('and it goes a penny over the budget', () => {
      it('needs a proposal, saying how far over it goes', () => {
        const result = classifyPurchase({
          isMemberPaidConsumable: false,
          amountPence: 30_001,
          yearlyBudgetPence: 100_000,
          spentThisYearPence: 70_000,
        });
        expect(result.outcome).toStrictEqual('budget-proposal-needed');
        expect(result.approval).toStrictEqual('proposal');
        expect(result.reason).toContain('£1,000.01');
        expect(result.reason).toContain('£1,000.00');
      });
    });

    describe('and the purchasing area has no budget', () => {
      it('needs a proposal for any amount', () => {
        const result = classifyPurchase({
          isMemberPaidConsumable: false,
          amountPence: 1,
          yearlyBudgetPence: 0,
          spentThisYearPence: 0,
        });
        expect(result.outcome).toStrictEqual('budget-proposal-needed');
      });
    });

    describe('and the budget is already overspent', () => {
      it('needs a proposal', () => {
        const result = classifyPurchase({
          isMemberPaidConsumable: false,
          amountPence: 500,
          yearlyBudgetPence: 100_000,
          spentThisYearPence: 120_000,
        });
        expect(result.outcome).toStrictEqual('budget-proposal-needed');
      });
    });
  });
});
