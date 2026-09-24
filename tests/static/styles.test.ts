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
