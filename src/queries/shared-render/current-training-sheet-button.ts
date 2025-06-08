import {html, sanitizeString} from '../../types/html';

export const currentTrainingSheetButton = (trainingSheetId: string) => {
  return html`<li>
    <a
      href="https://docs.google.com/spreadsheets/d/${sanitizeString(
        trainingSheetId
      )}"
    >
      Current training sheet
    </a>
  </li>`;
};
