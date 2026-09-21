import {DateTime} from 'luxon';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {
  Block,
  DetectedBoundary,
  NeighbourEvent,
  Region,
  SelectedEvent,
  ViewModel,
} from './view-model';

const PRECISION_FILL = '#2563eb'; // whole-second import regions
const DENSITY_FILL = '#7c3aed'; // burst / dump regions
const BULK_FILL = '#059669'; // bulk same-type runs (informational)
const HIGHLIGHT_FILL = '#dc2626'; // events matching ?highlight=<type prefix>
// In truncate mode: a dump region is compressed to at most this many
// event-widths, and every block is given at least MIN_BLOCK_WIDTH so the tiny
// blocks stay visible.
const TRUNCATED_DUMP_WIDTH = 120;
const MIN_BLOCK_WIDTH = 100;

// --- SVG geometry -----------------------------------------------------------
const WIDTH = 1800;
const HEIGHT = 520;
const PAD = {top: 20, right: 20, bottom: 44, left: 68};
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

// Distinct outline colours cycled across blocks so adjacent boxes are legible.
const BLOCK_COLOURS = [
  '#2563eb',
  '#dc2626',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#be185d',
];

const round = (n: number): number => Math.round(n * 10) / 10;

const fmtDate = (ms: number): string =>
  DateTime.fromMillis(ms).toFormat('yyyy-LL-dd');

const fmtDateTime = (ms: number): string =>
  DateTime.fromMillis(ms).toFormat('yyyy-LL-dd HH:mm:ss');

// An event_index rendered as a link to its own detail view.
const indexLink = (index: number) =>
  html`<a href="/event-log-order/${index}">${index}</a>`;

// x maps event position across the plot width; y maps recordedAt with the
// EARLIEST time at the bottom and the latest at the top. In truncate mode each
// event in a dump region gets a fractional x-width, so the whole dump collapses
// to ~TRUNCATED_DUMP_WIDTH event-widths (a broken axis) - the mapping stays
// monotone, so every block/region/seam still lands correctly.
const makeScales = (vm: ViewModel) => {
  const n = vm.totalEvents;
  const spanMs = Math.max(1, vm.maxRecordedAtMs - vm.minRecordedAtMs);
  const weight = new Array<number>(n).fill(1);
  if (vm.truncate) {
    // Per block, choose a display width: dumps are compressed to at most
    // TRUNCATED_DUMP_WIDTH, everything else is floored at MIN_BLOCK_WIDTH so
    // narrow blocks stay visible. Spread the width evenly across the block's
    // events. Blocks align with density regions, so a block is a dump when its
    // extent exactly matches one.
    const dumpExtents = new Set(
      vm.densityRuns.map(r => `${r.startPosition}:${r.endPosition}`)
    );
    for (const block of vm.blocks) {
      const count = block.endPosition - block.startPosition + 1;
      const isDump = dumpExtents.has(
        `${block.startPosition}:${block.endPosition}`
      );
      const displayWidth = isDump
        ? Math.min(count, TRUNCATED_DUMP_WIDTH)
        : Math.max(count, MIN_BLOCK_WIDTH);
      const w = displayWidth / count;
      for (let j = block.startPosition; j <= block.endPosition; j++) {
        weight[j] = w;
      }
    }
  }
  const cumStart = new Array<number>(n + 1);
  cumStart[0] = 0;
  for (let i = 0; i < n; i++) {
    cumStart[i + 1] = cumStart[i] + weight[i];
  }
  const total = Math.max(1e-9, cumStart[n]);
  const xOf = (position: number) => {
    const p = position < 0 ? 0 : position > n ? n : position;
    return PAD.left + (cumStart[p] / total) * PLOT_W;
  };
  const yOf = (ms: number) =>
    PAD.top + (1 - (ms - vm.minRecordedAtMs) / spanMs) * PLOT_H;
  return {xOf, yOf};
};

// Year gridlines across the visible time range.
const renderYearGrid = (
  vm: ViewModel,
  yOf: (ms: number) => number
): string => {
  const firstYear = DateTime.fromMillis(vm.minRecordedAtMs).year;
  const lastYear = DateTime.fromMillis(vm.maxRecordedAtMs).year;
  const lines: string[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    const ms = DateTime.fromObject({year, month: 1, day: 1}).toMillis();
    if (ms < vm.minRecordedAtMs || ms > vm.maxRecordedAtMs) {
      continue;
    }
    const y = round(yOf(ms));
    lines.push(
      `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + PLOT_W}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>` +
        `<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${year}</text>`
    );
  }
  return lines.join('');
};

// The event-order line itself: position on x, recordedAt on y. Ramps upward
// within a block and drops sharply at each seam.
const renderLine = (
  vm: ViewModel,
  xOf: (p: number) => number,
  yOf: (ms: number) => number
): string => {
  const pts = vm.points
    .map(p => `${round(xOf(p.position))},${round(yOf(p.recordedAtMs))}`)
    .join(' ');
  return `<polyline points="${pts}" fill="none" stroke="#111827" stroke-width="1"/>`;
};

// One outlined box per block, spanning its x-range and its time-range, plus a
// dashed vertical marker at each seam and a small block number.
const renderBlockBoxes = (
  vm: ViewModel,
  xOf: (p: number) => number,
  yOf: (ms: number) => number
): string => {
  const parts: string[] = [];
  vm.blocks.forEach((block, i) => {
    const colour = BLOCK_COLOURS[i % BLOCK_COLOURS.length];
    const x = round(xOf(block.startPosition));
    const xEnd = round(xOf(block.endPosition));
    const yTop = round(yOf(block.lastRecordedAtMs));
    const yBottom = round(yOf(block.firstRecordedAtMs));
    const w = Math.max(1, round(xEnd - x));
    const h = Math.max(1, round(yBottom - yTop));
    parts.push(
      `<rect x="${x}" y="${yTop}" width="${w}" height="${h}" fill="${colour}" fill-opacity="0.03" stroke="${colour}" stroke-opacity="0.5" stroke-width="1"/>` +
        `<text x="${x + 3}" y="${yTop + 13}" font-size="12" font-weight="bold" fill="${colour}" fill-opacity="0.85">${block.label}</text>`
    );
  });
  // seam markers (dashed vertical lines) drawn on top
  for (const seam of vm.seamPositions) {
    const x = round(xOf(seam));
    parts.push(
      `<line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${PAD.top + PLOT_H}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="3 3"/>`
    );
  }
  return parts.join('');
};

// In truncate mode, mark each compressed dump region with a faint grey band and
// dashed edges, so it is clear the x-axis is broken there.
const renderTruncationMarks = (vm: ViewModel, xOf: (p: number) => number): string =>
  vm.truncate
    ? vm.densityRuns
        .map(region => {
          const x = round(xOf(region.startPosition));
          const w = Math.max(1, round(xOf(region.endPosition) - x));
          return (
            `<rect x="${x}" y="${PAD.top}" width="${w}" height="${PLOT_H}" fill="#9ca3af" fill-opacity="0.12"/>` +
            `<line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${PAD.top + PLOT_H}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="2 2"/>` +
            `<line x1="${x + w}" y1="${PAD.top}" x2="${x + w}" y2="${PAD.top + PLOT_H}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="2 2"/>`
          );
        })
        .join('')
    : '';

// Whole-second import regions: a thin annotation strip along the TOP of the
// plot (a region is only about its x-range, so a full-height band would just be
// visual noise competing with the block boxes). Mirrors the bulk-runs strip.
const renderPrecisionRegions = (
  vm: ViewModel,
  xOf: (p: number) => number
): string =>
  vm.precisionRuns
    .map(region => {
      const x = round(xOf(region.startPosition));
      const w = Math.max(1, round(xOf(region.endPosition) - x));
      return `<rect x="${x}" y="${PAD.top + 1}" width="${w}" height="4" fill="${PRECISION_FILL}" fill-opacity="0.7"/>`;
    })
    .join('');

// Burst / dump regions: a second thin strip along the top, below the precision
// strip.
const renderDensityRegions = (
  vm: ViewModel,
  xOf: (p: number) => number
): string =>
  vm.densityRuns
    .map(region => {
      const x = round(xOf(region.startPosition));
      const w = Math.max(1, round(xOf(region.endPosition) - x));
      return `<rect x="${x}" y="${PAD.top + 6}" width="${w}" height="4" fill="${DENSITY_FILL}" fill-opacity="0.7"/>`;
    })
    .join('');

// Bulk same-type runs: a thin bar along the bottom of the plot (informational).
const renderBulkRuns = (vm: ViewModel, xOf: (p: number) => number): string =>
  vm.bulkTypeRuns
    .map(region => {
      const x = round(xOf(region.startPosition));
      const w = Math.max(1, round(xOf(region.endPosition) - x));
      const y = PAD.top + PLOT_H - 5;
      return `<rect x="${x}" y="${y}" width="${w}" height="4" fill="${BULK_FILL}" fill-opacity="0.55"/>`;
    })
    .join('');

const renderXAxis = (vm: ViewModel, xOf: (p: number) => number): string => {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const lastPos = Math.max(1, vm.totalEvents - 1);
  return ticks
    .map(frac => {
      const position = Math.round(frac * lastPos);
      const x = round(xOf(position));
      return (
        `<line x1="${x}" y1="${PAD.top + PLOT_H}" x2="${x}" y2="${PAD.top + PLOT_H + 4}" stroke="#6b7280"/>` +
        `<text x="${x}" y="${PAD.top + PLOT_H + 18}" text-anchor="middle" font-size="11" fill="#6b7280">${position}</text>`
      );
    })
    .join('');
};

const renderSvg = (vm: ViewModel): string => {
  const {xOf, yOf} = makeScales(vm);
  return (
    // Break out of the page's centred 90ch column to full viewport width, so the
    // narrow blocks have as much horizontal room as possible.
    `<div style="width:100vw;position:relative;left:50%;margin-left:-50vw;padding:0 1rem;box-sizing:border-box">` +
    `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" role="img" ` +
    `aria-label="Event recordedAt against position in the log" ` +
    `style="border:1px solid #e5e7eb;background:#fff;max-width:100%;height:auto;display:block">` +
    renderYearGrid(vm, yOf) +
    // faint region bands under everything, then boxes, then the line on top so
    // the data is never obscured
    renderTruncationMarks(vm, xOf) +
    renderPrecisionRegions(vm, xOf) +
    renderDensityRegions(vm, xOf) +
    renderBlockBoxes(vm, xOf, yOf) +
    renderLine(vm, xOf, yOf) +
    renderHighlight(vm, xOf, yOf) +
    renderBulkRuns(vm, xOf) +
    renderXAxis(vm, xOf) +
    `<text x="${PAD.left + PLOT_W / 2}" y="${HEIGHT - 4}" text-anchor="middle" font-size="11" fill="#374151">event position (event_index order) →</text>` +
    `</svg>` +
    `</div>`
  );
};

const renderTypeLine = (t: {type: string; count: number}) =>
  html`<div>${sanitizeString(t.type)} (${t.count})</div>`;

// Top three types always visible; the rest behind a native <details> toggle.
const renderEventTypeCounts = (block: Block) => {
  const all = block.eventTypeCounts;
  if (all.length <= 3) {
    return joinHtml(all.map(renderTypeLine));
  }
  return html`
    ${joinHtml(all.slice(0, 3).map(renderTypeLine))}
    <details>
      <summary>click to see all types (${all.length})</summary>
      ${joinHtml(all.map(renderTypeLine))}
    </details>
  `;
};

// The block's duplicate/overlap breakdown: for each other block it shares
// byte-identical events with, "<n> in <label> (<pct>%)". A 100% overlap means
// this block is wholly contained in the other (⊆).
const renderOverlap = (block: Block) => {
  if (block.overlaps.length === 0) {
    return block.duplicateCount > 0
      ? html`${block.duplicateCount} internal`
      : html`—`;
  }
  return joinHtml(
    block.overlaps.map(overlap => {
      const pct = Math.round((overlap.count / block.count) * 100);
      const line = html`${overlap.count} in ${sanitizeString(overlap.label)}
        (${pct}%)`;
      return pct >= 100
        ? html`<div><strong>${line}</strong> ⊆</div>`
        : html`<div>${line}</div>`;
    })
  );
};

const renderBlockRow = (block: Block, colour: string) => html`
  <tr>
    <td>
      <span
        style="display:inline-block;width:10px;height:10px;background:${safe(
          colour
        )};margin-right:6px"
      ></span
      >${sanitizeString(block.label)}
    </td>
    <td>${indexLink(block.startEventIndex)}–${indexLink(block.endEventIndex)}</td>
    <td>${block.count}</td>
    <td>
      ${safe(fmtDate(block.firstRecordedAtMs))} →
      ${safe(fmtDate(block.lastRecordedAtMs))}
    </td>
    <td>${renderOverlap(block)}</td>
    <td>${renderEventTypeCounts(block)}</td>
  </tr>
`;

// How a boundary is corroborated, shown after its signal list.
const renderCorroboration = (boundary: DetectedBoundary) => {
  if (!boundary.corroborated) {
    return html` <span style="color:#b45309"
      >⚠ density only, not homogeneous — low confidence: genuine activity (a
      foreign actor/type) appears near this edge, so it may be folded-in</span
    >`;
  }
  if (boundary.densityHomogeneous === true) {
    return html` <span style="color:#047857"
      >✓ density corroborated — the dump is homogeneous (no foreign actor/type)
      right up to the edge, so nothing was folded in</span
    >`;
  }
  // Corroborated by a structural signal (seam / precision).
  return html` <span style="color:#047857">✓ structural edge</span>`;
};

// A divider row placed between two block rows in the block table, showing where
// the boundary is, which signals detected it, and how it is corroborated.
const renderBoundaryDivider = (boundary: DetectedBoundary) => html`
  <tr>
    <td
      colspan="6"
      style="background:${boundary.corroborated
        ? safe('#f9fafb')
        : safe('#fffbeb')};font-size:0.85em;color:#6b7280;text-align:center"
    >
      ↕ boundary at event_index ${indexLink(boundary.eventIndex)} — detected by
      <strong>${safe(boundary.signals.join(' + '))}</strong
      >${renderCorroboration(boundary)}
    </td>
  </tr>
`;

const renderRegionRow = (region: Region) => html`
  <tr>
    <td>${region.label === '' ? safe('—') : sanitizeString(region.label)}</td>
    <td>${indexLink(region.startEventIndex)}–${indexLink(
  region.endEventIndex
)}</td>
    <td>${region.count}</td>
  </tr>
`;

// The detection legend + boundary/region tables, shown under the block table.
const renderSignals = (vm: ViewModel) => html`
  <section class="stack">
    <h2>How the blocks were detected</h2>
    <p>
      Blocks are split at boundaries found by two independent, data-driven
      signals — no boundary is hard-coded:
    </p>
    <ul>
      <li>
        <strong>seam</strong> (grey dashed line) — <code>recordedAt</code> steps
        backwards. Unambiguous, always trusted.
      </li>
      <li>
        <strong
          ><span style="color:${safe(PRECISION_FILL)}">whole-second region</span></strong
        >
        (blue strip along the top) — a long run of second-precision timestamps,
        the signature of an external import (the app itself writes millisecond
        precision). One region can span several blocks: a seam may split it
        without the precision changing.
      </li>
      <li>
        <strong
          ><span style="color:${safe(DENSITY_FILL)}">burst region</span></strong
        >
        (purple strip, just below the blue) — many events packed into under a day
        of <code>recordedAt</code>: a dump or bulk operation (e.g. a mass import
        run, or a bulk detail update). The density is orders of magnitude above
        live activity, so this reliably marks a block edge.
      </li>
    </ul>
    <p>
      The
      <strong
        ><span style="color:${safe(BULK_FILL)}">green strip</span></strong
      >
      along the bottom marks long <em>single-type</em> runs (bulk operations).
      These are shown for information only — they overlap the burst regions and
      the same bulk run can appear in live data, so they do <em>not</em> define
      blocks.
    </p>
    <p>
      Each boundary — and how it is corroborated — is shown as a divider row
      inside the block table above. A seam or precision edge is structural and
      trusted on its own. A <strong>density edge</strong> can smear (a dump folds
      in same-day activity before it ends), so it is corroborated by
      <strong>actor/type homogeneity</strong>: if the dump is all
      <code>system</code>/<code>token</code> of one kind right up to the edge it
      is <span style="color:#047857">✓ trusted</span> (nothing genuine folded
      in); if a <code>user</code> actor or a foreign type appears near the edge
      it is flagged <span style="color:#b45309">⚠ low-confidence</span>.
    </p>
    <h3>Bulk same-type runs (informational)</h3>
    ${vm.bulkTypeRuns.length === 0
      ? html`<p>None found.</p>`
      : html`<table>
          <thead>
            <tr>
              <th>type</th>
              <th>event_index</th>
              <th>rows</th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(vm.bulkTypeRuns.map(renderRegionRow))}
          </tbody>
        </table>`}
  </section>
`;

const renderWindowRow = (neighbour: NeighbourEvent) => html`
  <tr${neighbour.isSelected
    ? safe(' style="background:#fef3c7;font-weight:bold"')
    : ''}>
    <td>${indexLink(neighbour.eventIndex)}</td>
    <td>${sanitizeString(neighbour.type)}</td>
    <td>${safe(fmtDateTime(neighbour.recordedAtMs))}</td>
  </tr>
`;

// Rendered below the block table when the page is reached via
// /event-log-order/:index. Shows the selected event's neighbours (to make a
// seam obvious) and the full stored detail of the selected event.
const renderSelected = (selected: SelectedEvent) => {
  if (!selected.found) {
    return html`
      <section class="stack">
        <h2>Event ${selected.requestedIndex}</h2>
        <p>
          No event with <code>event_index</code> ${selected.requestedIndex}
          exists in the log.
        </p>
        <p><a href="/event-log-order">← Back to the overview</a></p>
      </section>
    `;
  }
  return html`
    <section class="stack-large">
      <h2>
        Event ${selected.requestedIndex}${selected.blockLabel !== null
          ? safe(` (block ${selected.blockLabel})`)
          : ''}
      </h2>
      <p>
        The selected event and the events immediately before and after it, in
        <code>event_index</code> order. The highlighted row is the selected
        event; compare the <code>recordedAt</code> column across it to spot a
        seam (a step backwards in time).
      </p>
      <table>
        <thead>
          <tr>
            <th>event_index</th>
            <th>type</th>
            <th>recordedAt</th>
          </tr>
        </thead>
        <tbody>
          ${joinHtml(selected.window.map(renderWindowRow))}
        </tbody>
      </table>
      <h3>Selected event detail</h3>
      <pre><code>${sanitizeString(selected.detailJson ?? '')}</code></pre>
      <p><a href="/event-log-order">← Back to the overview</a></p>
    </section>
  `;
};

const highlightedPoints = (vm: ViewModel) =>
  vm.highlightPrefix === null
    ? []
    : vm.points.filter(p => p.type.startsWith(vm.highlightPrefix as string));

// Highlighted events drawn on top of the line: a dot at each event's exact
// position/time, plus a thin tick strip just under the density strip so the
// spread stays visible where dots overlap. Correctly woven events trace along
// the polyline; a bulk append would collapse into one vertical column.
const renderHighlight = (
  vm: ViewModel,
  xOf: (position: number) => number,
  yOf: (recordedAtMs: number) => number
): string => {
  const points = highlightedPoints(vm);
  if (points.length === 0) {
    return '';
  }
  const dots = points
    .map(
      p =>
        `<circle cx="${round(xOf(p.position))}" cy="${round(yOf(p.recordedAtMs))}" r="2" fill="${HIGHLIGHT_FILL}" fill-opacity="0.8"/>`
    )
    .join('');
  const ticks = points
    .map(
      p =>
        `<rect x="${round(xOf(p.position))}" y="${PAD.top + 11}" width="1" height="4" fill="${HIGHLIGHT_FILL}"/>`
    )
    .join('');
  return dots + ticks;
};

// Summary + clear link for the highlight, and the most convincing verification
// figure on the page: how many blocks the highlighted events are spread over.
const renderHighlightSummary = (vm: ViewModel) => {
  if (vm.highlightPrefix === null) {
    return html``;
  }
  const prefix = vm.highlightPrefix;
  const base = vm.selected
    ? `/event-log-order/${vm.selected.requestedIndex}`
    : '/event-log-order';
  const points = highlightedPoints(vm);
  if (points.length === 0) {
    return html`
      <p>
        Highlight <code>${sanitizeString(prefix)}</code>: no matching events.
        <a href="${safe(base)}${vm.truncate ? safe('?truncate=1') : ''}"
          >clear</a
        >
      </p>
    `;
  }
  const indexes = points.map(p => p.eventIndex);
  const times = points.map(p => p.recordedAtMs);
  const blocksHit = vm.blocks.filter(
    block =>
      points.filter(
        p =>
          p.position >= block.startPosition && p.position <= block.endPosition
      ).length > 0
  ).length;
  const fmt = (ms: number) => DateTime.fromMillis(ms).toISODate() ?? '?';
  return html`
    <p>
      Highlighting
      <strong style="color:${safe(HIGHLIGHT_FILL)}"
        >${points.length} ${sanitizeString(prefix)}*</strong
      >
      event${points.length === 1 ? '' : safe('s')}: event_index
      ${Math.min(...indexes.slice(0, 1).concat(indexes))}–${Math.max(
        ...indexes.slice(0, 1).concat(indexes)
      )},
      recordedAt ${safe(fmt(Math.min(...times.slice(0, 1).concat(times))))} –
      ${safe(fmt(Math.max(...times.slice(0, 1).concat(times))))}, spread across
      <strong>${blocksHit} of ${vm.blocks.length}</strong> blocks.
      <a href="${safe(base)}${vm.truncate ? safe('?truncate=1') : ''}">clear</a>
    </p>
  `;
};

// Toggle between the linear x-axis and one that compresses the dump regions.
const renderViewToggle = (vm: ViewModel) => {
  const base = vm.selected
    ? `/event-log-order/${vm.selected.requestedIndex}`
    : '/event-log-order';
  return html`
    <p>
      x-axis:
      ${vm.truncate
        ? html`<a href="${safe(base)}">all data</a> ·
            <strong>readable</strong> — long dumps (grey bands) are compressed
            and narrow blocks are widened to a minimum size`
        : html`<strong>all data</strong> ·
            <a href="${safe(base)}?truncate=1">compress dumps &amp; widen small
              blocks</a> for readability`}
    </p>
  `;
};

export const render = (vm: ViewModel) => html`
  <div class="stack-large">
    <h1>Event log order</h1>
    <p>
      Each point is one event: its <strong>position</strong> in the stored log
      (<code>event_index</code> order) on the x-axis, against the
      <strong>recordedAt</strong> time it claims on the y-axis (earliest at the
      bottom). Where the line drops, the log steps backwards in time — a
      <em>seam</em>. The outlined boxes are the detected <em>blocks</em>; they
      are drawn straight from the data (see “How the blocks were detected”
      below), not hard-coded.
    </p>
    <p>
      <strong>${vm.totalEvents}</strong> events,
      <strong>${vm.seamPositions.length}</strong> seam${vm.seamPositions
        .length === 1
        ? ''
        : safe('s')}, <strong>${vm.blocks.length}</strong> block${vm.blocks
        .length === 1
        ? ''
        : safe('s')}.
    </p>
    ${vm.totalEvents === 0
      ? html`<p>No events in the log.</p>`
      : html`
          ${renderViewToggle(vm)} ${renderHighlightSummary(vm)}
          ${safe(renderSvg(vm))}
          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>event_index</th>
                <th>rows</th>
                <th>recordedAt span</th>
                <th>duplicates</th>
                <th>all event types</th>
              </tr>
            </thead>
            <tbody>
              ${joinHtml(
                vm.blocks.flatMap((block, i) => {
                  const row = renderBlockRow(
                    block,
                    BLOCK_COLOURS[i % BLOCK_COLOURS.length]
                  );
                  // Boundary i sits between block i and block i+1.
                  return i < vm.boundaries.length
                    ? [row, renderBoundaryDivider(vm.boundaries[i])]
                    : [row];
                })
              )}
            </tbody>
          </table>
          ${renderSignals(vm)}
        `}
    ${vm.selected !== null ? renderSelected(vm.selected) : ''}
  </div>
`;
