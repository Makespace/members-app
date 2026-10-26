import {html, Html, safe, sanitizeString} from '../../types/html';
import {
  renderDescription,
  sessionWhen,
  spacesLeft,
  TrainingSessionView,
  trainerLabel,
} from '../../queries/shared-render/upcoming-training-sessions';

// The session being confirmed, said once at the top of each sign-up page so
// nobody confirms the wrong one.
export const renderSessionSummary = (
  equipmentName: string,
  session: TrainingSessionView
): Html => html`
  <dl class="training-summary">
    <dt>Equipment</dt>
    <dd>${sanitizeString(equipmentName)}</dd>
    <dt>When</dt>
    <dd>${sessionWhen(session)}</dd>
    <dt>Trainer</dt>
    <dd>${trainerLabel(session)}</dd>
    <dt>Spaces</dt>
    <dd>${spacesLeft(session)}</dd>
  </dl>
  ${renderDescription(session)}
`;

export const backToTraining = (equipmentId: string, equipmentName: string) =>
  html`<p>
    <a href="/equipment/${safe(equipmentId)}/training"
      >Back to training on ${sanitizeString(equipmentName)}</a
    >
  </p>`;
