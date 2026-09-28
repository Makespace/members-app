import {readFileSync} from 'fs';
import path from 'path';

// A missing brace in the stylesheet is invisible to the type checker and the
// linter, but silently swallows every rule that follows it into the
// unterminated block. That is how the equipment category dots lost their
// styling on desktop: a bad merge dropped the closing brace of a mobile
// @media block, trapping everything after it. Cheap guard against a repeat.
describe('styles.css', () => {
  const css = readFileSync(
    path.join(__dirname, '../../src/static/styles.css'),
    'utf8'
  );

  const code = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  const braceReport = () => {
    let depth = 0;
    let line = 1;
    let outermostOpenedAt: number | null = null;
    for (const character of code) {
      if (character === '\n') {
        line++;
        continue;
      }
      if (character === '{') {
        if (depth === 0) {
          outermostOpenedAt = line;
        }
        depth++;
      } else if (character === '}') {
        depth--;
        if (depth < 0) {
          return {problem: `unmatched '}' at line ${line}`};
        }
        if (depth === 0) {
          outermostOpenedAt = null;
        }
      }
    }
    return depth === 0
      ? {problem: null}
      : {
          problem: `${depth} unclosed block(s); the outermost starts at line ${outermostOpenedAt}`,
        };
  };

  // A button that moves on mousedown moves out from under the pointer, and
  // the click never completes. That is exactly what happened to the "print
  // this sign" button, which is anchored to the corner of its sign: the
  // press nudge was `position: relative`, which beat the absolute placement
  // and dropped the button to the bottom of the block mid-click.
  it('re-hides a hidden element it has given display: contents', () => {
    expect(code).toContain('.mailbox__actions .mailbox__state[hidden]');
  });

  // A table cell given any other display stops being a table cell: it no
  // longer stretches to the row, and its bottom border lands under its own
  // content rather than along the row. The mailbox actions were laid out as
  // a grid on the cell itself, and sat in a box of their own with a rule
  // halfway up the row. The grid belongs on a block inside the cell.
  it('leaves the mailbox actions cell a table cell', () => {
    const cellRules = [
      ...code.matchAll(/(^|\})\s*\.mailbox__actions\s*\{([^}]*)\}/g),
    ].map(match => match[2]);

    expect(cellRules.length).toBeGreaterThan(0);
    for (const rule of cellRules) {
      expect(rule).not.toMatch(/display\s*:/);
    }
  });

  it('nudges a pressed button without re-positioning it', () => {
    const activeRules = [...code.matchAll(/(^|\})\s*[^{}]*:active\s*\{([^}]*)\}/g)]
      .map(match => match[2]);

    expect(activeRules.length).toBeGreaterThan(0);
    for (const rule of activeRules) {
      expect(rule).not.toMatch(/position\s*:/);
    }
  });

  it('has balanced braces, so no rule is trapped in an unterminated block', () => {
    expect(braceReport()).toStrictEqual({problem: null});
  });
});
