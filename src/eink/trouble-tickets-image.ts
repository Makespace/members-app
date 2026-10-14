import {SKRSContext2D} from '@napi-rs/canvas';
import {DateTime, IANAZone} from 'luxon';
import qrcode from 'qrcode-generator';
import {TroubleTicket, TroubleTicketStatus} from '../types/trouble-ticket';
import {
  FONT_FAMILY,
  Palette,
  renderToPng,
  TONE,
  Tones,
} from './render-to-png';

// One machine's open trouble tickets, drawn for an e-ink display mounted on
// it. Top to bottom: the machine's name in a black band with today's date in
// its corner; a headline saying whether the machine can be used; then the
// tickets, newest first - title, status, how long it has been open, whether
// someone has picked it up - beside a QR code to the machine's page.
// Submitter details are left off.
//
// The date is the only clock in the picture: the image changes once a day, at
// midnight in London, so a display that is still updating shows today's date
// - a glance tells you it's alive.

type DisplayTicket = {
  title: string;
  status: TroubleTicketStatus;
  submittedAt: Date;
  // What the reporter ticked under "What's the status of the machine?",
  // joined as the form sends it.
  machineStatus: string;
  assigned: boolean;
};

type TroubleTicketsImageModel = {
  equipmentName: string;
  // The machine's page, for the QR code.
  pageUrl: string;
  today: Date;
  tickets: ReadonlyArray<DisplayTicket>;
};

export const openTickets = (
  tickets: ReadonlyArray<TroubleTicket>
): ReadonlyArray<DisplayTicket> =>
  [...tickets]
    .filter(ticket => ticket.status !== 'Resolved')
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
    .map(ticket => ({
      title: ticket.title,
      status: ticket.status,
      submittedAt: ticket.submittedAt,
      machineStatus: ticket.response.status,
      assigned: ticket.assignedMemberNumbers.length > 0,
    }));

// The parts of the raise form's answers (MACHINE_STATUSES) that mean "don't
// use it". Matched as lower-case fragments because tickets from the old
// Google Form are free text that has drifted (curly apostrophes, clipped
// words); a test pins each fragment to exactly one of the form's options.
export const UNSAFE_ANSWER = 'unsafe';
export const NOT_WORKING_ANSWER = 'not working';

type Warning = 'unsafe' | 'not-working';

// What this ticket's reporter said that should stop someone using it.
const warning = (ticket: DisplayTicket): Warning | undefined => {
  const said = ticket.machineStatus.toLowerCase();
  if (said.includes(UNSAFE_ANSWER)) {
    return 'unsafe';
  }
  if (said.includes(NOT_WORKING_ANSWER)) {
    return 'not-working';
  }
  return undefined;
};

type MachineState = Warning | 'open-tickets' | 'clear';

// The worst any open ticket's reporter said about the machine.
export const machineState = (
  tickets: ReadonlyArray<DisplayTicket>
): MachineState => {
  const warnings = tickets.map(warning);
  if (warnings.includes('unsafe')) {
    return 'unsafe';
  }
  if (warnings.includes('not-working')) {
    return 'not-working';
  }
  return tickets.length > 0 ? 'open-tickets' : 'clear';
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const headline = (state: MachineState, openCount: number) => {
  switch (state) {
    case 'unsafe':
      return 'Reported unsafe - do not use';
    case 'not-working':
      return 'Reported not working';
    case 'open-tickets':
      return `Usable, with ${plural(openCount, 'open ticket')}`;
    case 'clear':
      return 'No open trouble tickets';
  }
};

const STATUS_CHIP: Record<TroubleTicketStatus, string> = {
  Todo: 'OPEN',
  'In Progress': 'IN PROGRESS',
  'Needs Help': 'NEEDS HELP',
  Parked: 'PARKED',
  Resolved: 'RESOLVED',
};

const LONDON = new IANAZone('Europe/London');
const londonDay = (date: Date) =>
  DateTime.fromJSDate(date).setZone(LONDON).setLocale('en-GB').startOf('day');

const dateLabel = (today: Date) => londonDay(today).toFormat('ccc d LLL');

// How long until the date in the corner turns over.
export const msUntilLondonMidnight = (now: Date) =>
  londonDay(now).plus({days: 1}).toMillis() - now.getTime();

// How long a ticket has been open, in London calendar days.
export const openFor = (submittedAt: Date, today: Date) => {
  const days = Math.max(
    0,
    Math.round(londonDay(today).diff(londonDay(submittedAt), 'days').days)
  );
  if (days === 0) {
    return 'reported today';
  }
  if (days === 1) {
    return 'reported yesterday';
  }
  if (days < 14) {
    return `open ${days} days`;
  }
  if (days < 60) {
    return `open ${plural(Math.floor(days / 7), 'week')}`;
  }
  return `open ${plural(Math.floor(days / 30), 'month')}`;
};

// Sizes are designed for a 480px short side and scaled from there, with
// floors so a small panel stays legible rather than proportional.
const layoutFor = (width: number, height: number) => {
  const short = Math.min(width, height);
  const scale = short / 480;
  const size = (design: number, floor: number) =>
    Math.max(floor, Math.round(design * scale));
  return {
    pad: size(20, 4),
    header: size(40, 14),
    date: size(30, 11),
    headline: size(32, 12),
    title: size(28, 12),
    meta: size(20, 10),
    chip: size(16, 8),
    rule: Math.max(1, Math.round(2 * scale)),
    // A QR code wants room to be scanned: landscape panels big enough to
    // give it a column of its own, else it's left out.
    qr: width >= 1.4 * height && short >= 240 ? Math.round(short * 0.4) : 0,
  };
};

const font = (px: number, bold = false) =>
  `${bold ? 'bold ' : ''}${px}px "${FONT_FAMILY}"`;

// Cut text to fit, ending with an ellipsis, when it is too wide.
const fitWidth = (ctx: SKRSContext2D, text: string, maxWidth: number) => {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let cut = text;
  while (cut.length > 0 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
};

// Greedy word wrap into at most maxLines lines; the last line carries an
// ellipsis when text is left over. A word too long for a line is broken.
const wrap = (
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): ReadonlyArray<string> => {
  const words = text.split(/\s+/).filter(word => word !== '');
  const lines: string[] = [];
  let line = '';
  let index = 0;
  while (index < words.length && lines.length < maxLines) {
    const candidate = line === '' ? words[index] : `${line} ${words[index]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      index++;
    } else if (line === '') {
      // One word wider than the line: break it where it overflows.
      let fits = 1;
      while (
        fits < words[index].length &&
        ctx.measureText(words[index].slice(0, fits + 1)).width <= maxWidth
      ) {
        fits++;
      }
      lines.push(words[index].slice(0, fits));
      words[index] = words[index].slice(fits);
    } else {
      lines.push(line);
      line = '';
    }
  }
  if (line !== '' && lines.length < maxLines) {
    lines.push(line);
  }
  if (index < words.length && lines.length > 0) {
    lines[lines.length - 1] = fitWidth(
      ctx,
      `${lines[lines.length - 1]} ${words.slice(index).join(' ')}`,
      maxWidth
    );
  }
  return lines;
};

// The QR code as whole-pixel modules, so its edges stay crisp on e-ink.
// Level Q, like the printed signs: a quarter of it can be dusty or scuffed.
const drawQr = (
  ctx: SKRSContext2D,
  content: string,
  x: number,
  y: number,
  size: number,
  palette: Palette
) => {
  const qr = qrcode(0, 'Q');
  qr.addData(content);
  qr.make();
  const count = qr.getModuleCount();
  // Two modules of quiet zone drawn here; the white around the column is
  // the rest.
  const module = Math.floor(size / (count + 4));
  const offset = Math.floor((size - module * count) / 2);
  ctx.fillStyle = palette.ink;
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      if (qr.isDark(row, column)) {
        ctx.fillRect(
          x + offset + column * module,
          y + offset + row * module,
          module,
          module
        );
      }
    }
  }
};

// A status label: white on black for NEEDS HELP (it's asking for someone),
// outlined for the rest. Returns its width.
const drawChip = (
  ctx: SKRSContext2D,
  status: TroubleTicketStatus,
  x: number,
  y: number,
  layout: ReturnType<typeof layoutFor>,
  palette: Palette
) => {
  const label = STATUS_CHIP[status];
  ctx.font = font(layout.chip, true);
  const padX = Math.round(layout.chip * 0.5);
  const height = Math.round(layout.chip * 1.5);
  const width = Math.round(ctx.measureText(label).width) + 2 * padX;
  const top = y + Math.round((layout.meta - height) / 2);
  const stroke = Math.max(1, layout.rule);
  ctx.fillStyle = palette.ink;
  if (status === 'Needs Help') {
    ctx.fillRect(x, top, width, height);
    ctx.fillStyle = TONE.white;
  } else {
    ctx.fillRect(x, top, width, stroke);
    ctx.fillRect(x, top + height - stroke, width, stroke);
    ctx.fillRect(x, top, stroke, height);
    ctx.fillRect(x + width - stroke, top, stroke, height);
  }
  ctx.fillText(label, x + padX, top + Math.round((height - layout.chip) / 2));
  return width;
};

const draw =
  (model: TroubleTicketsImageModel, width: number, height: number) =>
  (ctx: SKRSContext2D, palette: Palette) => {
    const layout = layoutFor(width, height);
    ctx.textBaseline = 'top';

    // Header band: the machine's name, today's date in the corner.
    const bandHeight = Math.round(layout.header * 1.6);
    ctx.fillStyle = palette.ink;
    ctx.fillRect(0, 0, width, bandHeight);
    ctx.fillStyle = TONE.white;
    ctx.font = font(layout.date, true);
    const date = dateLabel(model.today);
    // On a panel too narrow for both, the machine's name wins.
    const dateFits =
      width - 3 * layout.pad - ctx.measureText(date).width >= 3 * layout.header;
    const dateWidth = dateFits ? ctx.measureText(date).width : 0;
    if (dateFits) {
      ctx.fillText(
        date,
        width - layout.pad - dateWidth,
        Math.round((bandHeight - layout.date) / 2)
      );
    }
    ctx.font = font(layout.header, true);
    ctx.fillText(
      fitWidth(
        ctx,
        model.equipmentName,
        width - 3 * layout.pad - dateWidth
      ),
      layout.pad,
      Math.round((bandHeight - layout.header) / 2)
    );

    // Headline: can I use it? The two "don't" answers get a band of their
    // own; the rest is plain bold text. Two lines at most, for narrow panels.
    const state = machineState(model.tickets);
    const banded = state === 'unsafe' || state === 'not-working';
    const inset = banded ? 2 * layout.pad : layout.pad;
    const headlineLine = Math.round(layout.headline * 1.25);
    ctx.font = font(layout.headline, true);
    const headlineLines = wrap(
      ctx,
      headline(state, model.tickets.length),
      width - 2 * inset,
      2
    );
    let y = bandHeight + layout.pad;
    if (banded) {
      const headlineBand =
        headlineLines.length * headlineLine + Math.round(layout.headline * 0.6);
      ctx.fillStyle = palette.ink;
      ctx.fillRect(layout.pad, y, width - 2 * layout.pad, headlineBand);
      ctx.fillStyle = TONE.white;
      headlineLines.forEach((line, i) =>
        ctx.fillText(
          line,
          inset,
          y + Math.round(layout.headline * 0.3) + i * headlineLine
        )
      );
      y += headlineBand + layout.pad;
    } else {
      ctx.fillStyle = palette.ink;
      headlineLines.forEach((line, i) =>
        ctx.fillText(line, inset, y + i * headlineLine)
      );
      y += headlineLines.length * headlineLine + layout.pad;
    }

    // QR column on the right, captioned with what scanning it leads to.
    const bottom = height - layout.pad;
    const listRight =
      layout.qr > 0 ? width - 2 * layout.pad - layout.qr : width - layout.pad;
    if (layout.qr > 0) {
      const qrX = width - layout.pad - layout.qr;
      drawQr(ctx, model.pageUrl, qrX, y, layout.qr, palette);
      ctx.fillStyle = palette.muted;
      ctx.font = font(layout.meta);
      wrap(
        ctx,
        'Scan to report a problem, read the guide or get trained',
        layout.qr,
        3
      ).forEach((line, i) => {
        const lineWidth = ctx.measureText(line).width;
        ctx.fillText(
          line,
          qrX + Math.round((layout.qr - lineWidth) / 2),
          y + layout.qr + i * Math.round(layout.meta * 1.25)
        );
      });
    }

    // The tickets, newest first.
    const textWidth = listRight - layout.pad;
    const titleLine = Math.round(layout.title * 1.2);
    const metaLine = Math.round(layout.meta * 1.5);
    const gap = Math.round(layout.pad * 0.8);

    for (const [i, ticket] of model.tickets.entries()) {
      const remaining = model.tickets.length - i;
      // Keep room for the "N more" line under any entry that is not the last.
      const reserve = remaining > 1 ? metaLine + gap : 0;
      const room = bottom - reserve - y;
      const maxTitleLines = Math.min(
        3,
        Math.floor((room - metaLine) / titleLine)
      );
      if (maxTitleLines < 1) {
        ctx.fillStyle = palette.muted;
        ctx.font = font(layout.meta, true);
        ctx.fillText(
          fitWidth(
            ctx,
            `+ ${plural(remaining, 'more open ticket')}`,
            textWidth
          ),
          layout.pad,
          y
        );
        return;
      }

      if (i > 0) {
        ctx.fillStyle = palette.rule;
        ctx.fillRect(
          layout.pad,
          y - Math.round(gap / 2),
          textWidth,
          Math.max(1, Math.round(layout.rule * palette.ruleWeight))
        );
      }

      ctx.fillStyle = palette.ink;
      ctx.font = font(layout.title);
      const title = ticket.title.trim() === '' ? '(untitled)' : ticket.title;
      for (const line of wrap(ctx, title, textWidth, maxTitleLines)) {
        ctx.fillText(line, layout.pad, y);
        y += titleLine;
      }

      // Status, age, and whether anyone has it.
      const chipWidth = drawChip(
        ctx,
        ticket.status,
        layout.pad,
        y,
        layout,
        palette
      );
      ctx.fillStyle = palette.muted;
      ctx.font = font(layout.meta);
      const facts = [openFor(ticket.submittedAt, model.today)];
      const warned = warning(ticket);
      if (warned !== undefined) {
        facts.push(warned === 'unsafe' ? 'said unsafe' : 'said not working');
      }
      if (ticket.assigned) {
        facts.push("someone's on it");
      }
      const metaX = layout.pad + chipWidth + Math.round(layout.meta * 0.6);
      ctx.fillText(
        fitWidth(ctx, facts.join(' · '), listRight - metaX),
        metaX,
        y
      );
      y += metaLine + gap;
    }
  };

export const renderTroubleTicketsImage = (
  model: TroubleTicketsImageModel,
  width: number,
  height: number,
  tones: Tones = 4
): Buffer => renderToPng(width, height, tones, draw(model, width, height));
