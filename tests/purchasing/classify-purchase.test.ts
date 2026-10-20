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
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
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
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
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
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
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
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
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
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
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
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
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
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
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
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
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
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
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
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
          isMemberPaidConsumable: false,
          amountPence: 500,
          yearlyBudgetPence: 100_000,
          spentThisYearPence: 120_000,
        });
        expect(result.outcome).toStrictEqual('budget-proposal-needed');
      });
    });
  });

  describe('when it affects other areas or is a health and safety risk', () => {
    const within = {
      isMemberPaidConsumable: false,
      amountPence: 10_000,
      yearlyBudgetPence: 100_000,
      spentThisYearPence: 0,
      affectedAreaNames: [],
      healthAndSafetyRisk: false,
    };

    it('needs a proposal even within budget, so the other owners can give their input', () => {
      const result = classifyPurchase({
        ...within,
        affectedAreaNames: ['Metal Shop', 'Textiles', 'Laser Cutters'],
      });
      expect(result).toStrictEqual({
        outcome: 'budget-proposal-needed',
        approval: 'proposal',
        reason:
          'This comes out of the yearly budget, leaving £900.00 of £1,000.00 for the rest of the year. It affects Metal Shop, Textiles and Laser Cutters too, so it needs a proposal giving their owners a chance to give their input.',
      });
    });

    it('needs a proposal with a risk assessment for a health and safety risk', () => {
      expect(
        classifyPurchase({...within, healthAndSafetyRisk: true}).reason
      ).toContain(
        'It presents a moderate to high health and safety risk, so it needs a proposal with a risk assessment.'
      );
    });

    it('gives every reason that applies', () => {
      const result = classifyPurchase({
        ...within,
        amountPence: 150_000,
        affectedAreaNames: ['Metal Shop'],
        healthAndSafetyRisk: true,
      });
      expect(result.reason).toBe(
        'A single purchase of £1,000.00 or more needs a proposal. It affects Metal Shop too, so it needs a proposal giving their owners a chance to give their input. It presents a moderate to high health and safety risk, so it needs a proposal with a risk assessment.'
      );
    });

    it('can need a proposal for a consumable, while it still stays off the budget', () => {
      const result = classifyPurchase({
        ...within,
        isMemberPaidConsumable: true,
        healthAndSafetyRisk: true,
      });
      expect(result.outcome).toBe('consumable');
      expect(result.approval).toBe('proposal');
    });

    it('names two areas with "and"', () => {
      expect(
        classifyPurchase({...within, affectedAreaNames: ['A', 'B']}).reason
      ).toContain('It affects A and B too');
    });
  });
});
