import {createHash} from 'node:crypto';
import {Request, Response} from 'express';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../dependencies';
import {constantTimeEqual} from '../http/constant-time-equal';
import {resolveEquipmentReference} from '../queries/equipment/resolve-reference';
import {openTickets, renderTroubleTicketsImage} from './trouble-tickets-image';
import {Tones} from './render-to-png';

// GET /equipment/:equipment/trouble-tickets.png?width=800&height=480&tones=4&wait=0
//
// A machine's open trouble tickets as a four-tone PNG - two-tone for a panel
// that asks for tones=2 - for an e-ink display that polls this URL and redraws
// when the image changes. A display cannot log in, so it presents the shared
// display token (EINK_DISPLAY_TOKEN) as a bearer token instead; nothing else
// gets an image, or learns which machines exist. The image still leaves out
// who reported each ticket. A display that sends back the ETag it has, with
// wait=N, is held up to N seconds for the image to change.
//
// Displays are reflashed rarely, so what they rely on is written down in
// docs/eink-displays.md and pinned by tests/eink/display-contract.test.ts.

export const troubleTicketsImageRoute =
  '/equipment/:equipment/trouble-tickets.png';

// Whether a request is for that image, without a router: the session
// middleware runs before routing and must leave these requests alone (see
// src/index.ts). Case-insensitive and tolerant of a trailing slash, as
// express's own route matching is.
export const isTroubleTicketsImagePath = (path: string) =>
  /^\/equipment\/[^/]+\/trouble-tickets\.png\/?$/i.test(path);

const DEFAULT_SIZE = {width: 800, height: 480};
const MIN_SIDE = 64;
const MAX_SIDE = 2000;

// Longest a display is held waiting for a change. Fly's proxy drops a
// connection that has sent nothing either way for 60s, and a held request
// sends nothing until it answers, so a hold stays comfortably inside that.
const MAX_WAIT_SECONDS = 55;
// How often a held request looks for a change: one read of the read model's
// event index. The image is only redrawn when that has moved, which happens
// at most once per read-model refresh (every 10s).
const CHANGE_CHECK_MS = 1000;

type DisplayOptions = {
  width: number;
  height: number;
  tones: Tones;
  wait: number;
};

const parseTones = (raw: unknown): E.Either<string, Tones> => {
  if (raw === undefined || raw === '4') {
    return E.right(4);
  }
  return raw === '2' ? E.right(2) : E.left('tones must be 2 or 4');
};

const parseWait = (raw: unknown): E.Either<string, number> => {
  if (raw === undefined) {
    return E.right(0);
  }
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return E.left('wait must be a whole number of seconds');
  }
  return E.right(Math.min(Number(raw), MAX_WAIT_SECONDS));
};

export const parseDisplayOptions = (
  query: Request['query']
): E.Either<string, DisplayOptions> => {
  const side = (name: 'width' | 'height'): E.Either<string, number> => {
    const raw = query[name];
    if (raw === undefined) {
      return E.right(DEFAULT_SIZE[name]);
    }
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      return E.left(`${name} must be a whole number of pixels`);
    }
    const value = Number(raw);
    return value >= MIN_SIDE && value <= MAX_SIDE
      ? E.right(value)
      : E.left(`${name} must be between ${MIN_SIDE} and ${MAX_SIDE}`);
  };
  return pipe(
    E.Do,
    E.apS('width', side('width')),
    E.apS('height', side('height')),
    E.apS('tones', parseTones(query.tones)),
    E.apS('wait', parseWait(query.wait))
  );
};

type Image = {png: Buffer; etag: string};

// The machine's image as things stand, or none if there is no such machine.
const currentImage =
  (deps: Dependencies, reference: string, options: DisplayOptions) =>
  (): O.Option<Image> =>
    pipe(
      resolveEquipmentReference(deps)(reference),
      O.chain(deps.sharedReadModel.equipment.get),
      O.map(equipment =>
        renderTroubleTicketsImage(
          {
            equipmentName: equipment.name,
            tickets: openTickets(
              deps.sharedReadModel.troubleTickets.getByEquipment(equipment.id)
            ),
          },
          options.width,
          options.height,
          options.tones
        )
      ),
      O.map(png => ({
        png,
        etag: `"${createHash('sha256').update(png).digest('hex').slice(0, 32)}"`,
      }))
    );

// The image only changes when the tickets do, so the ETag lets a display (or
// anything between) skip the download; express answers 304 itself when
// If-None-Match matches.
const sendImage = (res: Response, image: Image) => {
  res.setHeader('ETag', image.etag);
  res.setHeader('Cache-Control', 'no-cache');
  res.type('image/png').send(image.png);
};

const sendUnknownEquipment = (res: Response) => {
  res.status(StatusCodes.NOT_FOUND).type('text/plain').send('Unknown equipment');
};

const displayAlreadyHas = (req: Request, image: Image) =>
  (req.headers['if-none-match'] ?? '')
    .split(',')
    .some(tag => tag.trim().replace(/^W\//, '') === image.etag);

// A display that already has the image and asked to wait is held until the
// image changes - answered at once with the new one - or the wait runs out,
// when it gets its own image back, which express turns into 304. A display
// that hangs up stops the checking.
const hold = (
  deps: Dependencies,
  imageNow: () => O.Option<Image>,
  image: Image,
  waitSeconds: number,
  res: Response
) => {
  const timers: {check?: NodeJS.Timeout; deadline?: NodeJS.Timeout} = {};
  const stop = () => {
    clearInterval(timers.check);
    clearTimeout(timers.deadline);
    res.off('close', stop);
  };
  let eventIndex = deps.sharedReadModel.getCurrentEventIndex();
  timers.check = setInterval(() => {
    const latest = deps.sharedReadModel.getCurrentEventIndex();
    if (latest === eventIndex) {
      return;
    }
    eventIndex = latest;
    const now = imageNow();
    if (O.isNone(now)) {
      stop();
      sendUnknownEquipment(res);
    } else if (now.value.etag !== image.etag) {
      stop();
      sendImage(res, now.value);
    }
  }, CHANGE_CHECK_MS);
  timers.deadline = setTimeout(() => {
    stop();
    sendImage(res, image);
  }, waitSeconds * 1000);
  res.on('close', stop);
};

// Whether the request carries the display token. Checked before anything
// else, so a request without it costs no rendering and cannot tell a real
// machine from a made-up one.
const hasDisplayToken = (req: Request, token: string) =>
  constantTimeEqual(req.headers.authorization ?? '', `Bearer ${token}`);

export const equipmentTroubleTicketsImage =
  (deps: Dependencies) => (req: Request, res: Response) => {
    if (!hasDisplayToken(req, deps.conf.EINK_DISPLAY_TOKEN)) {
      res.status(StatusCodes.UNAUTHORIZED);
      res.setHeader('WWW-Authenticate', 'Bearer realm="e-ink displays"');
      res.type('text/plain').send('Display token required');
      return;
    }
    const options = parseDisplayOptions(req.query);
    if (E.isLeft(options)) {
      res.status(StatusCodes.BAD_REQUEST).type('text/plain').send(options.left);
      return;
    }
    const imageNow = currentImage(deps, req.params.equipment, options.right);
    const image = imageNow();
    if (O.isNone(image)) {
      sendUnknownEquipment(res);
      return;
    }
    if (options.right.wait > 0 && displayAlreadyHas(req, image.value)) {
      hold(deps, imageNow, image.value, options.right.wait, res);
      return;
    }
    sendImage(res, image.value);
  };
