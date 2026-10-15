import {
  classifyPurchase,
  ClassificationAnswers,
  DIRECTORS_APPROVAL_THRESHOLD_PENCE,
  PROPOSAL_THRESHOLD_PENCE,
} from '../../src/purchasing/classify-purchase';
import {getLeftOrFail, getRightOrFail} from '../helpers';

const capexAnswers: ClassificationAnswers = {
  isMemberPaidConsumable: false,
  isOperations: false,
  under100PerYear: false,
};

const roomyBudget = {
  yearlyBudgetPence: 500_000,
  spentThisYearPence: 0,
};

describe('classifyPurchase', () => {
  it('treats £1,000 as the proposal threshold', () => {
    expect(PROPOSAL_THRESHOLD_PENCE).toStrictEqual(100_000);
  });

  it("treats £500 as the directors' approval threshold", () => {
    expect(DIRECTORS_APPROVAL_THRESHOLD_PENCE).toStrictEqual(50_000);
  });

  describe('when it is a consumable members pay for at point of use', () => {
    const result = getRightOrFail(
      classifyPurchase({
        answers: {
          isMemberPaidConsumable: true,
          isOperations: false,
          under100PerYear: false,
        },
        amountPence: 250_000,
        yearlyBudgetPence: 0,
        spentThisYearPence: 0,
      })
    );

    it('is OpEx (consumable), however much it costs', () => {
      expect(result.outcome).toStrictEqual('opex-consumable');
    });

    it('needs no approval', () => {
      expect(result.approval).toStrictEqual('none');
    });

    it('explains that it does not use the budget', () => {
      expect(result.reason).toContain('consumable');
      expect(result.reason).toContain("doesn't come out of the yearly budget");
    });

    it('drops the answers to questions that were not needed', () => {
      expect(result.answers).toStrictEqual({
        isMemberPaidConsumable: true,
        isOperations: null,
        under100PerYear: null,
      });
    });
  });

  describe('when the later questions are left unanswered after a consumable', () => {
    it('is still OpEx (consumable)', () => {
      const result = getRightOrFail(
        classifyPurchase({
          answers: {
            isMemberPaidConsumable: true,
            isOperations: null,
            under100PerYear: null,
          },
          amountPence: 2_000,
          ...roomyBudget,
        })
      );
      expect(result.outcome).toStrictEqual('opex-consumable');
    });
  });

  describe('when it is maintenance, running cost or like-for-like replacement', () => {
    const result = getRightOrFail(
      classifyPurchase({
        answers: {
          isMemberPaidConsumable: false,
          isOperations: true,
          under100PerYear: false,
        },
        // Fixing the planer-thicknesser.
        amountPence: 63_000,
        yearlyBudgetPence: 10_000,
        spentThisYearPence: 10_000,
      })
    );

    it('is OpEx (operations), even with the budget used up', () => {
      expect(result.outcome).toStrictEqual('opex-operations');
    });

    it("needs the directors' approval, being over £500", () => {
      expect(result.approval).toStrictEqual('directors');
      expect(result.reason).toContain("over £500.00 it needs the directors' approval");
    });

    it('drops the answer to the under-£100 question', () => {
      expect(result.answers).toStrictEqual({
        isMemberPaidConsumable: false,
        isOperations: true,
        under100PerYear: null,
      });
    });
  });

  describe('when operations spending is exactly £500', () => {
    const result = getRightOrFail(
      classifyPurchase({
        answers: {
          isMemberPaidConsumable: false,
          isOperations: true,
          under100PerYear: null,
        },
        amountPence: 50_000,
        ...roomyBudget,
      })
    );

    it('is OpEx (operations)', () => {
      expect(result.outcome).toStrictEqual('opex-operations');
    });

    it("does not need the directors' approval", () => {
      expect(result.approval).toStrictEqual('none');
      expect(result.reason).not.toContain('directors');
    });
  });

  describe('when operations spending is £500.01', () => {
    it("needs the directors' approval", () => {
      const result = getRightOrFail(
        classifyPurchase({
          answers: {
            isMemberPaidConsumable: false,
            isOperations: true,
            under100PerYear: null,
          },
          amountPence: 50_001,
          ...roomyBudget,
        })
      );
      expect(result.outcome).toStrictEqual('opex-operations');
      expect(result.approval).toStrictEqual('directors');
    });
  });

  describe('when it costs under £100 a year', () => {
    const result = getRightOrFail(
      classifyPurchase({
        answers: {
          isMemberPaidConsumable: false,
          isOperations: false,
          under100PerYear: true,
        },
        amountPence: 4_500,
        yearlyBudgetPence: 0,
        spentThisYearPence: 0,
      })
    );

    it('is OpEx (low cost)', () => {
      expect(result.outcome).toStrictEqual('opex-low-cost');
    });

    it('needs no approval', () => {
      expect(result.approval).toStrictEqual('none');
    });

    it('keeps all three answers', () => {
      expect(result.answers).toStrictEqual({
        isMemberPaidConsumable: false,
        isOperations: false,
        under100PerYear: true,
      });
    });
  });

  describe('when it is CapEx', () => {
    describe('and comfortably within the budget', () => {
      const result = getRightOrFail(
        classifyPurchase({
          answers: capexAnswers,
          amountPence: 25_000,
          yearlyBudgetPence: 150_000,
          spentThisYearPence: 50_000,
        })
      );

      it('comes from the yearly budget', () => {
        expect(result.outcome).toStrictEqual('capex-from-budget');
      });

      it('needs no approval', () => {
        expect(result.approval).toStrictEqual('none');
      });

      it('says what is left afterwards', () => {
        expect(result.reason).toContain('£750.00');
        expect(result.reason).toContain('£1,500.00');
      });
    });

    describe('and exactly £1,000 in a single purchase', () => {
      it('needs a proposal', () => {
        const result = getRightOrFail(
          classifyPurchase({
            answers: capexAnswers,
            amountPence: 100_000,
            ...roomyBudget,
          })
        );
        expect(result.outcome).toStrictEqual('capex-proposal-needed');
        expect(result.approval).toStrictEqual('proposal');
        expect(result.reason).toContain('£1,000.00 or more');
      });
    });

    describe('and a penny under £1,000 with budget to spare', () => {
      it('comes from the yearly budget', () => {
        const result = getRightOrFail(
          classifyPurchase({
            answers: capexAnswers,
            amountPence: 99_999,
            ...roomyBudget,
          })
        );
        expect(result.outcome).toStrictEqual('capex-from-budget');
      });
    });

    describe('and over £1,000', () => {
      it('needs a proposal even with budget to spare', () => {
        const result = getRightOrFail(
          classifyPurchase({
            answers: capexAnswers,
            amountPence: 250_000,
            yearlyBudgetPence: 1_000_000,
            spentThisYearPence: 0,
          })
        );
        expect(result.outcome).toStrictEqual('capex-proposal-needed');
      });
    });

    describe('and it lands exactly on the budget', () => {
      it('comes from the yearly budget, leaving nothing', () => {
        const result = getRightOrFail(
          classifyPurchase({
            answers: capexAnswers,
            amountPence: 30_000,
            yearlyBudgetPence: 100_000,
            spentThisYearPence: 70_000,
          })
        );
        expect(result.outcome).toStrictEqual('capex-from-budget');
        expect(result.reason).toContain('leaving £0.00');
      });
    });

    describe('and it goes a penny over the budget', () => {
      it('needs a proposal, saying how far over it goes', () => {
        const result = getRightOrFail(
          classifyPurchase({
            answers: capexAnswers,
            amountPence: 30_001,
            yearlyBudgetPence: 100_000,
            spentThisYearPence: 70_000,
          })
        );
        expect(result.outcome).toStrictEqual('capex-proposal-needed');
        expect(result.approval).toStrictEqual('proposal');
        expect(result.reason).toContain('£1,000.01');
        expect(result.reason).toContain('£1,000.00');
      });
    });

    describe('and the purchasing area has no budget', () => {
      it('needs a proposal for any amount', () => {
        const result = getRightOrFail(
          classifyPurchase({
            answers: capexAnswers,
            amountPence: 1,
            yearlyBudgetPence: 0,
            spentThisYearPence: 0,
          })
        );
        expect(result.outcome).toStrictEqual('capex-proposal-needed');
      });
    });

    describe('and the budget is already overspent', () => {
      it('needs a proposal', () => {
        const result = getRightOrFail(
          classifyPurchase({
            answers: capexAnswers,
            amountPence: 500,
            yearlyBudgetPence: 100_000,
            spentThisYearPence: 120_000,
          })
        );
        expect(result.outcome).toStrictEqual('capex-proposal-needed');
      });
    });
  });

  describe('when it is not a consumable and the operations question is unanswered', () => {
    it('asks for that answer', () => {
      const result = getLeftOrFail(
        classifyPurchase({
          answers: {
            isMemberPaidConsumable: false,
            isOperations: null,
            under100PerYear: true,
          },
          amountPence: 1_000,
          ...roomyBudget,
        })
      );
      expect(result.question).toStrictEqual('isOperations');
    });
  });

  describe('when it is neither consumable nor operations and the cost question is unanswered', () => {
    it('asks for that answer', () => {
      const result = getLeftOrFail(
        classifyPurchase({
          answers: {
            isMemberPaidConsumable: false,
            isOperations: false,
            under100PerYear: null,
          },
          amountPence: 1_000,
          ...roomyBudget,
        })
      );
      expect(result.question).toStrictEqual('under100PerYear');
    });
  });
});
