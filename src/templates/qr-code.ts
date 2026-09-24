import qrcode from 'qrcode-generator';
import {Html, html, safe} from '../types/html';

// QR codes are generated on the server as SVG: a sign has to print reliably
// from any browser, and an image built by client-side script is exactly the
// thing that fails silently in a print dialog.
//
// Error correction level Q tolerates about a quarter of the code being
// obscured, which matters for a label stuck to a machine that will collect
// dust, oil and the odd thumbprint.
export const qrCodeSvg = (content: string, sizePx: number): Html => {
  const qr = qrcode(0, 'Q');
  qr.addData(content);
  qr.make();

  const count = qr.getModuleCount();
  // A quiet zone of four modules is required by the spec; scanners are
  // unreliable without it.
  const margin = 4;
  const extent = count + margin * 2;

  const squares: string[] = [];
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      if (qr.isDark(row, column)) {
        squares.push(
          `M${column + margin} ${row + margin}h1v1h-1z`
        );
      }
    }
  }

  return html`<svg
    class="qr"
    width="${safe(String(sizePx))}"
    height="${safe(String(sizePx))}"
    viewBox="0 0 ${safe(String(extent))} ${safe(String(extent))}"
    role="img"
    aria-label="QR code"
    shape-rendering="crispEdges"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="${safe(String(extent))}" height="${safe(String(extent))}" fill="#fff" />
    <path d="${safe(squares.join(''))}" fill="#000" />
  </svg>`;
};
