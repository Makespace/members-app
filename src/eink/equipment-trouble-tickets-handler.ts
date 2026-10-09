import {createHash} from 'node:crypto';
import {Request, Response} from 'express';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../dependencies';
import {resolveEquipmentReference} from '../queries/equipment/resolve-reference';
import {openTickets, renderTroubleTicketsImage} from './trouble-tickets-image';

// GET /equipment/:equipment/trouble-tickets.png?width=800&height=480
//
// A machine's open trouble tickets as a four-tone PNG, for an e-ink display
// that polls this URL and redraws when the image changes. Deliberately public:
// the display cannot log in, and the image shows nothing a member standing at
// the machine couldn't read - titles and statuses, no submitter details.
//
// Displays are reflashed rarely, so what they rely on is written down in
// docs/eink-displays.md and pinned by tests/eink/display-contract.test.ts.

const DEFAULT_SIZE = {width: 800, height: 480};
const MIN_SIDE = 64;
const MAX_SIDE = 2000;

export const parseDisplaySize = (
  query: Request['query']
): E.Either<string, {width: number; height: number}> => {
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
    E.apS('height', side('height'))
  );
};

export const equipmentTroubleTicketsImage =
  (deps: Dependencies) => (req: Request, res: Response) => {
    const size = parseDisplaySize(req.query);
    if (E.isLeft(size)) {
      res.status(StatusCodes.BAD_REQUEST).type('text/plain').send(size.left);
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
      size.right.width,
      size.right.height
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
