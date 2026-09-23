// Every reply in a thread carries the whole conversation quoted beneath it,
// so reading a thread top to bottom means reading the first message once for
// every message that followed it. These split a message into what its sender
// actually wrote and the history they quoted, so the history can be folded
// away rather than thrown away.

type SplitMessage = {
  reply: string;
  quoted: string;
};

const ATTRIBUTION = /^\s*On\b[\s\S]*?\bwrote:\s*$/;
const OUTLOOK_SEPARATOR = /^\s*(-{2,}\s*Original Message\s*-{2,}|_{10,})\s*$/i;
const QUOTE_LINE = /^\s*>/;

// An attribution line often wraps, so a candidate is joined with the next
// couple of lines before deciding.
const attributionEndsAt = (
  lines: ReadonlyArray<string>,
  start: number
): number | null => {
  if (!/^\s*On\b/.test(lines[start])) {
    return null;
  }
  let joined = lines[start];
  for (let end = start; end < Math.min(start + 3, lines.length); end++) {
    if (end > start) {
      joined = `${joined} ${lines[end]}`;
    }
    if (ATTRIBUTION.test(joined)) {
      return end;
    }
  }
  return null;
};

const firstQuotedLine = (lines: ReadonlyArray<string>): number | null => {
  for (let i = 0; i < lines.length; i++) {
    if (OUTLOOK_SEPARATOR.test(lines[i])) {
      return i;
    }
    const attributionEnd = attributionEndsAt(lines, i);
    if (attributionEnd !== null) {
      // Only an attribution that actually introduces quoted text: a sentence
      // beginning "On Tuesday I..." is not a quote header.
      const next = lines.slice(attributionEnd + 1).find(line => line.trim() !== '');
      if (next === undefined || QUOTE_LINE.test(next)) {
        return i;
      }
    }
    if (QUOTE_LINE.test(lines[i])) {
      return i;
    }
  }
  return null;
};

export const splitQuotedText = (text: string): SplitMessage => {
  const lines = text.split('\n');
  const cut = firstQuotedLine(lines);
  if (cut === null) {
    return {reply: text, quoted: ''};
  }
  const reply = lines.slice(0, cut).join('\n').replace(/\s+$/, '');
  // A message that is nothing but quoted history still needs showing.
  if (reply.trim() === '') {
    return {reply: text, quoted: ''};
  }
  return {reply, quoted: lines.slice(cut).join('\n')};
};

// Gmail, and most clients that copy it, wrap quoted history in a known
// container. Cutting at the container's opening tag is crude - the remainder
// is not balanced HTML - but it renders inside a sandboxed frame where the
// browser's parser tidies up, and the whole message stays available.
const HTML_QUOTE_MARKERS = [
  /<div[^>]*class="[^"]*gmail_quote[^"]*"/i,
  /<blockquote[^>]*type="cite"/i,
  /<div[^>]*id="appendonly"/i,
];

export const splitQuotedHtml = (bodyHtml: string): SplitMessage => {
  const cuts = HTML_QUOTE_MARKERS.map(marker => bodyHtml.search(marker)).filter(
    index => index > 0
  );
  if (cuts.length === 0) {
    return {reply: bodyHtml, quoted: ''};
  }
  const cut = Math.min(...cuts);
  const reply = bodyHtml.slice(0, cut);
  // Cutting can leave nothing but wrapper markup, and a message that is
  // entirely quoted history still needs reading.
  if (reply.replace(/<[^>]*>/g, '').trim() === '') {
    return {reply: bodyHtml, quoted: ''};
  }
  return {reply, quoted: bodyHtml.slice(cut)};
};
