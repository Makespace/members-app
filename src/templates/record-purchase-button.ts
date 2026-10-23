import {html} from '../types/html';
import {superUserActions, superUserButton} from './super-user';

// For super users and a purchasing area's purchasers: the purchase request
// form with "I'm authorising and making this purchase myself" already
// chosen. Shown beside "Request a purchase".
export const renderRecordPurchaseButton = (purchasingAreaId?: string) =>
  superUserActions(
    superUserButton(
      `/purchase-requests/submit?${new URLSearchParams({
        buyingDirectly: 'true',
        ...(purchasingAreaId ? {purchasingArea: purchasingAreaId} : {}),
      }).toString()}`,
      html`Record a purchase`
    ),
    'Super users and purchasers'
  );
