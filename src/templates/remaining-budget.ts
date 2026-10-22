import {html, sanitizeString} from '../types/html';
import {formatPence} from '../types/money';

// A purchasing area's remaining budget, in orange once it's below zero.
export const renderRemaining = (remainingPence: number) =>
  remainingPence < 0
    ? html`<span class="budget-overspent"
        >${sanitizeString(formatPence(remainingPence))}</span
      >`
    : sanitizeString(formatPence(remainingPence));
