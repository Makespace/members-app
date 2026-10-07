import {UUID} from 'io-ts-types';
import {subscriptionForTicket} from '../../src/trouble-tickets/notification-audience';
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

const whenFor = (
  t: Parameters<typeof subscriptionForTicket>[2],
  stored?: ReadonlyMap<string, string>
) => subscriptionForTicket(scopesFor(stored), ME, t, areaOfEquipment);

describe('how soon somebody hears about one ticket', () => {
  it('uses the machine when the ticket names one they are named on', () => {
    expect(whenFor(ticket({equipmentId: BANDSAW as UUID}))).toBe('daily');
  });

  // The machine has no rule of its own, so the area it sits in answers.
  it('falls back to the area for a machine they are not named on', () => {
    expect(whenFor(ticket({equipmentId: PLANER as UUID}))).toBe('weekly');
  });

  it('uses the area when the ticket names an area and no machine', () => {
    expect(whenFor(ticket({areaId: WOOD as UUID}))).toBe('weekly');
  });

  it('says nothing about an area they have nothing to do with', () => {
    expect(whenFor(ticket({equipmentId: LASER as UUID}))).toBe('none');
  });

  // A ticket that matched no machine and no area at all.
  it('falls to the rule about everywhere else when it belongs nowhere', () => {
    expect(whenFor(ticket({}))).toBe('none');
  });

  describe('a ticket they reported themselves', () => {
    it('is heard about as it happens, whatever the area says', () => {
      expect(
        whenFor(
          ticket({areaId: WOOD as UUID, submittedMemberNumber: ME})
        )
      ).toBe('live');
    });

    // Both rules apply; the more immediate of them is the answer, so a weekly
    // area does not hold back news about your own ticket.
    it('still applies somewhere they hear nothing about', () => {
      expect(
        whenFor(
          ticket({equipmentId: LASER as UUID, submittedMemberNumber: ME})
        )
      ).toBe('live');
    });

    it('does not apply to somebody else’s ticket', () => {
      expect(
        whenFor(
          ticket({
            equipmentId: LASER as UUID,
            submittedMemberNumber: SOMEBODY_ELSE,
          })
        )
      ).toBe('none');
    });
  });

  describe('once somebody has said something of their own', () => {
    it('takes what they chose for that machine', () => {
      expect(
        whenFor(
          ticket({equipmentId: PLANER as UUID}),
          new Map([[`equipment:${PLANER}`, 'live']])
        )
      ).toBe('live');
    });

    it('takes what they chose for the area beneath it', () => {
      expect(
        whenFor(
          ticket({equipmentId: PLANER as UUID}),
          new Map([[`area:${WOOD}`, 'none']])
        )
      ).toBe('none');
    });

    // Following an area they have nothing to do with, which is the whole
    // point of listing every area on the page.
    it('lets them follow an area that is not theirs', () => {
      expect(
        whenFor(
          ticket({equipmentId: LASER as UUID}),
          new Map([[`area:${METAL}`, 'live']])
        )
      ).toBe('live');
    });

    it('lets them go quiet about their own machine', () => {
      expect(
        whenFor(
          ticket({equipmentId: BANDSAW as UUID}),
          new Map([[`equipment:${BANDSAW}`, 'none']])
        )
      ).toBe('none');
    });
  });
});
