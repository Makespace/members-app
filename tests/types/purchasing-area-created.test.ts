import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {DomainEvent} from '../../src/types/domain-event';

// Each purchasing area has its own small purchase amount: new ones start at
// £500, and ones created before it could be set keep the £1,000 that applied
// to every purchasing area until then.
describe('a PurchasingAreaCreated event', () => {
  const stored = {
    type: 'PurchasingAreaCreated',
    id: faker.string.uuid(),
    name: 'Wood Shop',
    yearlyBudgetPence: 100_000,
    actor: {tag: 'system'},
    recordedAt: new Date().toISOString(),
  };

  it('from before small purchase amounts were set keeps £1,000', () => {
    expect(DomainEvent.decode(stored)).toMatchObject(
      E.right({smallPurchaseAmountPence: 100_000})
    );
  });

  it('keeps the small purchase amount it was created with', () => {
    expect(
      DomainEvent.decode({...stored, smallPurchaseAmountPence: 50_000})
    ).toMatchObject(E.right({smallPurchaseAmountPence: 50_000}));
  });
});
