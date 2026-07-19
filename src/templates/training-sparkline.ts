import {html, joinHtml, safe} from '../types/html';
import {QuarterCount} from '../read-models/shared-state/member/training-delivered';

// Tufte-style sparkline: one small green bar per quarter (oldest left, current
// quarter at the right), bar height scaled to the count. Hovering a bar shows
// the count via a native SVG <title>.
const SPARK_BAR_WIDTH = 6;
const SPARK_BAR_GAP = 3;
const SPARK_HEIGHT = 16;
const SPARK_MAX_BAR = 13;

export const renderTrainingSparkline = (
  quarters: ReadonlyArray<QuarterCount>
) => {
  const maxCount = Math.max(1, ...quarters.map(q => q.count));
  const width =
    quarters.length * SPARK_BAR_WIDTH + (quarters.length - 1) * SPARK_BAR_GAP;
  const total = quarters.reduce((sum, q) => sum + q.count, 0);
  const bars = quarters.map((quarter, i) => {
    // Zero quarters get a 1px baseline tick so the quarter is still visible.
    const barHeight =
      quarter.count === 0
        ? 1
        : Math.max(2, Math.round((SPARK_MAX_BAR * quarter.count) / maxCount));
    const x = i * (SPARK_BAR_WIDTH + SPARK_BAR_GAP);
    const barClass =
      quarter.count === 0 ? html`spark-bar spark-bar--empty` : html`spark-bar`;
    return html`<rect
      class="${barClass}"
      x="${x}"
      y="${SPARK_HEIGHT - barHeight}"
      width="${SPARK_BAR_WIDTH}"
      height="${barHeight}"
    >
      <title>
        ${quarter.label}: ${quarter.count} training${
          quarter.count === 1 ? html`` : html`s`
        }
      </title>
    </rect>`;
  });
  return html`<svg
    class="sparkline"
    width="${width}"
    height="${SPARK_HEIGHT}"
    viewBox="0 0 ${width} ${SPARK_HEIGHT}"
    role="img"
    aria-label="${total} trainings delivered over the last ${quarters.length} quarters"
  >
    ${joinHtml(bars)}
  </svg>`;
};
