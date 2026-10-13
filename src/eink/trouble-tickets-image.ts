import {SKRSContext2D} from '@napi-rs/canvas';
import {DateTime, IANAZone} from 'luxon';
import {TroubleTicket, TroubleTicketStatus} from '../types/trouble-ticket';
import {
  FONT_FAMILY,
  Palette,
  renderToPng,
  TONE,
  Tones,
} from './render-to-png';

// The open trouble tickets for one machine, drawn for an e-ink display
// mounted on it: the machine's name in a band across the top, then one entry
// per ticket - its title and how it stands - newest first. Submitter details
// are left off; the display hangs in the space for anyone to read.

type TroubleTicketsImageModel = {
  equipmentName: string;
  tickets: ReadonlyArray<{
    title: string;
    status: TroubleTicketStatus;
    submittedAt: Date;
  }>;
};

export const openTickets = (
  tickets: ReadonlyArray<TroubleTicket>
): TroubleTicketsImageModel['tickets'] =>
  [...tickets]
    .filter(ticket => ticket.status !== 'Resolved')
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
    .map(({title, status, submittedAt}) => ({title, status, submittedAt}));

const STATUS_LABEL: Record<TroubleTicketStatus, string> = {
  Todo: 'Open',
  'In Progress': 'In progress',
  'Needs Help': 'Needs help',
  Parked: 'Parked',
  Resolved: 'Resolved',
};

const reportedOn = (date: Date) =>
  DateTime.fromJSDate(date)
    .setLocale('en-GB')
    .setZone(new IANAZone('Europe/London'))
    .toFormat('d LLL yyyy');

// Sizes are designed for a 480px short side and scaled from there, with
// floors so a small panel stays legible rather than proportional.
const layoutFor = (width: number, height: number) => {
  const scale = Math.min(width, height) / 480;
  const size = (design: number, floor: number) =>
    Math.max(floor, Math.round(design * scale));
  return {
    pad: size(20, 4),
    header: size(40, 14),
    title: size(28, 12),
    meta: size(20, 10),
    rule: Math.max(1, Math.round(2 * scale)),
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

const draw =
  (model: TroubleTicketsImageModel, width: number, height: number) =>
  (ctx: SKRSContext2D, palette: Palette) => {
    const layout = layoutFor(width, height);
    const textWidth = width - 2 * layout.pad;
    ctx.textBaseline = 'top';

    // Header band: the machine's name, white on black.
    const bandHeight = Math.round(layout.header * 1.6);
    ctx.fillStyle = palette.ink;
    ctx.fillRect(0, 0, width, bandHeight);
    ctx.fillStyle = TONE.white;
    ctx.font = font(layout.header, true);
    ctx.fillText(
      fitWidth(ctx, model.equipmentName, textWidth),
      layout.pad,
      Math.round((bandHeight - layout.header) / 2)
    );

    let y = bandHeight + layout.pad;
    const bottom = height - layout.pad;

    if (model.tickets.length === 0) {
      ctx.fillStyle = palette.ink;
      ctx.font = font(layout.title, true);
      ctx.fillText(
        fitWidth(ctx, 'No open trouble tickets', textWidth),
        layout.pad,
        y
      );
      return;
    }

    const titleLine = Math.round(layout.title * 1.2);
    const metaLine = Math.round(layout.meta * 1.3);
    const gap = Math.round(layout.pad * 0.6);

    for (const [i, ticket] of model.tickets.entries()) {
      const remaining = model.tickets.length - i;
      // Keep room for the "N more" line under any entry that is not the last.
      const reserve = remaining > 1 ? metaLine + gap : 0;
      const room = bottom - reserve - y;
      const maxTitleLines = Math.min(
        3,
        Math.floor((room - layout.meta) / titleLine)
      );
      if (maxTitleLines < 1) {
        ctx.fillStyle = palette.muted;
        ctx.font = font(layout.meta, true);
        ctx.fillText(
          `+ ${remaining} more open ticket${remaining === 1 ? '' : 's'}`,
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

      ctx.fillStyle = palette.muted;
      ctx.font = font(layout.meta);
      ctx.fillText(
        fitWidth(
          ctx,
          `${STATUS_LABEL[ticket.status]} · reported ${reportedOn(ticket.submittedAt)}`,
          textWidth
        ),
        layout.pad,
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
