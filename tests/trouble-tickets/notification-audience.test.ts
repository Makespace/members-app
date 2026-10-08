import {UUID} from 'io-ts-types';
import {deliveryForTicket} from '../../src/trouble-tickets/notification-audience';
import {preferencesFor} from '../../src/trouble-tickets/notification-preferences';
import {TroubleTicket} from '../../src/types/trouble-ticket';

const WOOD = 'a-wood';
const METAL = 'a-metal';
const BANDSAW = 'e-bandsaw';
const PLANER = 'e-planer';
const LASER = 'e-laser';
const ME = 50;
const SOMEBODY_ELSE = 51;

const areas = [
  {id: WOOD, name: 'Wood Shop'},
  {id: METAL, name: 'Metal Shop'},
];

const equipment = [
  {id: BANDSAW, name: 'Band Saw', areaId: WOOD},
  {id: PLANER, name: 'Planer', areaId: WOOD},
  {id: LASER, name: 'Laser Cutter', areaId: METAL},
];

const areaOfEquipment = new Map(
  equipment.map(item => [item.id, item.areaId])
);

// Owns the Wood Shop and is named on the Band Saw, which is the shape the
// defaults are written for.
const scopesFor = (stored: ReadonlyMap<string, string> = new Map()) =>
  preferencesFor(
    {
      ownerOf: [
        {id: WOOD, name: 'Wood Shop', ownershipRecordedAt: new Date()},
      ],
      trainerFor: [
        {
          equipment_id: BANDSAW as UUID,
          equipment_name: 'Band Saw',
          since: new Date(),
        },
      ],
    },
    equipment,
    areas,
    stored
  );

const ticket = (
  over: Partial<
    Pick<TroubleTicket, 'equipmentId' | 'areaId' | 'submittedMemberNumber'>
  >
) => ({
  equipmentId: null,
  areaId: null,
  submittedMemberNumber: null,
  ...over,
});

const deliveryFor = (
  t: Parameters<typeof deliveryForTicket>[2],
  stored?: ReadonlyMap<string, string>
) => deliveryForTicket(scopesFor(stored), ME, t, areaOfEquipment);

const inSummary = (cadence: 'daily' | 'weekly') => ({
  live: false,
  digest: cadence,
});
const atOnce = {live: true, digest: null};
const nothing = {live: false, digest: null};

describe('how soon somebody hears about one ticket', () => {
  it('uses the machine when the ticket names one they are named on', () => {
    expect(deliveryFor(ticket({equipmentId: BANDSAW as UUID}))).toStrictEqual(
      inSummary('daily')
    );
  });

  // The machine has no rule of its own, so the area it sits in answers.
  it('falls back to the area for a machine they are not named on', () => {
    expect(deliveryFor(ticket({equipmentId: PLANER as UUID}))).toStrictEqual(
      inSummary('weekly')
    );
  });

  it('uses the area when the ticket names an area and no machine', () => {
    expect(deliveryFor(ticket({areaId: WOOD as UUID}))).toStrictEqual(
      inSummary('weekly')
    );
  });

  it('says nothing about an area they have nothing to do with', () => {
    expect(deliveryFor(ticket({equipmentId: LASER as UUID}))).toStrictEqual(
      nothing
    );
  });

  // A ticket that matched no machine and no area at all.
  it('falls to the rule about everywhere else when it belongs nowhere', () => {
    expect(deliveryFor(ticket({}))).toStrictEqual(nothing);
  });

  describe('a ticket they reported themselves', () => {
    // Both rules apply, and they are different interests rather than
    // competing answers: being told at once, and the week's record being
    // complete. A summary that quietly left this out would be claiming less
    // happened than did.
    it('is heard about at once and still counted in the area’s summary', () => {
      expect(
        deliveryFor(ticket({areaId: WOOD as UUID, submittedMemberNumber: ME}))
      ).toStrictEqual({live: true, digest: 'weekly'});
    });

    it('is heard about at once somewhere they hear nothing else about', () => {
      expect(
        deliveryFor(
          ticket({equipmentId: LASER as UUID, submittedMemberNumber: ME})
        )
      ).toStrictEqual(atOnce);
    });

    it('does not apply to somebody else’s ticket', () => {
      expect(
        deliveryFor(
          ticket({
            equipmentId: LASER as UUID,
            submittedMemberNumber: SOMEBODY_ELSE,
          })
        )
      ).toStrictEqual(nothing);
    });

    // Their own machine is on a daily summary and their own report is live:
    // both say something, and neither is discarded.
    it('lands in the machine’s summary as well, when it has one', () => {
      expect(
        deliveryFor(
          ticket({equipmentId: BANDSAW as UUID, submittedMemberNumber: ME})
        )
      ).toStrictEqual({live: true, digest: 'daily'});
    });

    // One ticket in two summaries would be the same thing said twice, which
    // is the duplication actually worth avoiding.
    it('never lands in two summaries at once', () => {
      const delivery = deliveryFor(
        ticket({equipmentId: PLANER as UUID, submittedMemberNumber: ME}),
        new Map([['reported-by-me', 'daily']])
      );

      expect(delivery).toStrictEqual(inSummary('daily'));
    });
  });

  describe('once somebody has said something of their own', () => {
    it('takes what they chose for that machine', () => {
      expect(
        deliveryFor(
          ticket({equipmentId: PLANER as UUID}),
          new Map([[`equipment:${PLANER}`, 'live']])
        )
      ).toStrictEqual(atOnce);
    });

    it('takes what they chose for the area beneath it', () => {
      expect(
        deliveryFor(
          ticket({equipmentId: PLANER as UUID}),
          new Map([[`area:${WOOD}`, 'none']])
        )
      ).toStrictEqual(nothing);
    });

    // Following an area they have nothing to do with, which is the whole
    // point of listing every area on the page.
    it('lets them follow an area that is not theirs', () => {
      expect(
        deliveryFor(
          ticket({equipmentId: LASER as UUID}),
          new Map([[`area:${METAL}`, 'live']])
        )
      ).toStrictEqual(atOnce);
    });

    it('lets them go quiet about their own machine', () => {
      expect(
        deliveryFor(
          ticket({equipmentId: BANDSAW as UUID}),
          new Map([[`equipment:${BANDSAW}`, 'none']])
        )
      ).toStrictEqual(nothing);
    });
  });
});
