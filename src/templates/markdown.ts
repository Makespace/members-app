// A deliberately small markdown-to-HTML converter for admin-authored email
// bodies: links, bold, italics, unordered lists and paragraphs. Everything is
// HTML-escaped BEFORE formatting is applied, so no raw HTML can pass through.
// Kept dependency-free: the current markdown packages are ESM-only and this
// app compiles to CommonJS.

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// [label](https://example.com) - only http(s) URLs become links.
const applyLinks = (line: string): string =>
  line.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2">$1</a>'
  );

const applyEmphasis = (line: string): string =>
  line
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

const formatInline = (line: string): string =>
  applyEmphasis(applyLinks(escapeHtml(line)));

// Blocks are separated by blank lines; a block whose lines all start with
// "- " or "* " becomes a list, anything else a paragraph (single newlines
// become <br/>).
export const markdownToHtml = (markdown: string): string =>
  markdown
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(block => block !== '')
    .map(block => {
      const lines = block.split('\n').map(line => line.trim());
      if (lines.every(line => /^[-*] /.test(line))) {
        const items = lines
          .map(line => `<li>${formatInline(line.slice(2))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${lines.map(formatInline).join('<br/>')}</p>`;
    })
    .join('');
