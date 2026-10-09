import {createHash} from 'node:crypto';
import {Request, Response} from 'express';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../dependencies';
import {resolveEquipmentReference} from '../queries/equipment/resolve-reference';
import {openTickets, renderTroubleTicketsImage} from './trouble-tickets-image';
import {Tones} from './render-to-png';

// GET /equipment/:equipment/trouble-tickets.png?width=800&height=480&tones=4
//
// A machine's open trouble tickets as a four-tone PNG - two-tone for a panel
// that asks for tones=2 - for an e-ink display that polls this URL and redraws
// when the image changes. Deliberately public: the display cannot log in, and
// the image shows nothing a member standing at the machine couldn't read -
// titles and statuses, no submitter details.
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

const parseTones = (raw: unknown): E.Either<string, Tones> => {
  if (raw === undefined || raw === '4') {
    return E.right(4);
  }
  return raw === '2' ? E.right(2) : E.left('tones must be 2 or 4');
};

export const parseDisplayOptions = (
  query: Request['query']
): E.Either<string, {width: number; height: number; tones: Tones}> => {
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
    E.apS('tones', parseTones(query.tones))
  );
};

export const equipmentTroubleTicketsImage =
  (deps: Dependencies) => (req: Request, res: Response) => {
    const options = parseDisplayOptions(req.query);
    if (E.isLeft(options)) {
      res.status(StatusCodes.BAD_REQUEST).type('text/plain').send(options.left);
      return;
    }
    const equipment = pipe(
      resolveEquipmentReference(deps)(req.params.equipment),
      O.chain(deps.sharedReadModel.equipment.get)
    );
    if (O.isNone(equipment)) {
      res.status(StatusCodes.NOT_FOUND).type('text/plain').send('Unknown equipment');
      return;
    }
    const png = renderTroubleTicketsImage(
      {
        equipmentName: equipment.value.name,
        tickets: openTickets(
          deps.sharedReadModel.troubleTickets.getByEquipment(equipment.value.id)
        ),
      },
      options.right.width,
      options.right.height,
      options.right.tones
    );
    // The image only changes when the tickets do, so the ETag lets a display
    // (or anything between) skip the download; express answers 304 itself
    // when If-None-Match matches.
    res.setHeader(
      'ETag',
      `"${createHash('sha256').update(png).digest('hex').slice(0, 32)}"`
    );
    res.setHeader('Cache-Control', 'no-cache');
    res.type('image/png').send(png);
  };
