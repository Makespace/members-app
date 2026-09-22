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

  it('has balanced braces, so no rule is trapped in an unterminated block', () => {
    expect(braceReport()).toStrictEqual({problem: null});
  });
});
