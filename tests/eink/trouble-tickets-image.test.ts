import {faker} from '@faker-js/faker';
import {inflateSync} from 'node:zlib';
import {UUID} from 'io-ts-types';
import {MACHINE_STATUSES} from '../../src/commands/trouble-tickets/raise';
import {
  NOT_WORKING_ANSWER,
  UNSAFE_ANSWER,
  machineState,
  msUntilLondonMidnight,
  openFor,
  openTickets,
  renderTroubleTicketsImage,
} from '../../src/eink/trouble-tickets-image';
import {TroubleTicket, TroubleTicketStatus} from '../../src/types/trouble-ticket';

const ticket = (
  status: TroubleTicketStatus,
  submittedAt: Date,
  title = faker.lorem.sentence(),
  machineStatus = '',
  assignedMemberNumbers: ReadonlyArray<number> = []
): TroubleTicket => ({
  id: faker.string.uuid() as UUID,
  status,
  title,
  submittedAt,
  submittedName: faker.person.fullName(),
  submittedMemberNumber: null,
  submittedEmail: null,
  submittedEquipment: null,
  equipmentId: null,
  areaId: null,
  mailboxConversationId: null,
  assignedMemberNumbers,
  response: {
    otherEquipmentDetail: '',
    status: machineStatus,
    attempting: '',
    issue: '',
    steps: '',
  },
});

describe('openTickets', () => {
  it('keeps every ticket that is not resolved, newest first, without submitter details', () => {
    const tickets = openTickets([
      ticket('Parked', new Date('2026-01-01'), 'parked'),
      ticket('Resolved', new Date('2026-05-01'), 'resolved'),
      ticket('Todo', new Date('2026-03-01'), 'todo'),
      ticket('Needs Help', new Date('2026-04-01'), 'needs help'),
      ticket('In Progress', new Date('2026-02-01'), 'in progress'),
    ]);
    expect(tickets.map(t => t.title)).toEqual([
      'needs help',
      'todo',
      'in progress',
      'parked',
    ]);
    expect(Object.keys(tickets[0]).sort()).toEqual([
      'assigned',
      'machineStatus',
      'status',
      'submittedAt',
      'title',
    ]);
  });

  it('carries what the reporter said about the machine, and whether anyone has the ticket', () => {
    const [assigned, unassigned] = openTickets([
      ticket('Todo', new Date('2026-09-02'), 'a', "It's not working", [1234]),
      ticket('Todo', new Date('2026-09-01'), 'b'),
    ]);
    expect(assigned).toMatchObject({
      machineStatus: "It's not working",
      assigned: true,
    });
    expect(unassigned).toMatchObject({machineStatus: '', assigned: false});
  });
});

describe('machineState', () => {
  const said = (...answers: ReadonlyArray<string>) =>
    openTickets(
      answers.map(answer => ticket('Todo', new Date('2026-09-01'), 'x', answer))
    );

  it('is unsafe when any open ticket says so, whatever else is said', () => {
    expect(
      machineState(said("It's not working", 'Consumables needed, It is unsafe'))
    ).toBe('unsafe');
  });

  it('is not working when a ticket says so and none says unsafe', () => {
    expect(
      machineState(said('Consumables needed', "It's not working"))
    ).toBe('not-working');
  });

  it('is usable with open tickets when nobody said it is unsafe or not working', () => {
    expect(
      machineState(
        said("It's working but not adjusted/configured correctly", '')
      )
    ).toBe('open-tickets');
  });

  it('is clear with no open tickets', () => {
    expect(machineState([])).toBe('clear');
  });

  // Tickets from the old Google Form are free text that has drifted.
  it.each([
    ['It\u2019s not working', 'not-working'],
    ['IT IS UNSAFE', 'unsafe'],
    ['', 'open-tickets'],
  ])('reads the legacy answer %j as %s', (answer, state) => {
    expect(machineState(said(answer))).toBe(state);
  });

  // If the raise form's wording changes, these must change with it.
  it.each([UNSAFE_ANSWER, NOT_WORKING_ANSWER])(
    'finds "%s" in exactly one of the raise form\'s answers',
    fragment => {
      expect(
        MACHINE_STATUSES.filter(status =>
          status.toLowerCase().includes(fragment)
        )
      ).toHaveLength(1);
    }
  );
});

describe('msUntilLondonMidnight', () => {
  const hours = 3_600_000;
  it.each([
    // 23:59:50 on 9 Oct in London (BST), not UTC.
    ['2026-10-09T22:59:50Z', 10_000],
    // Exactly midnight: the next one, a day away.
    ['2026-10-09T23:00:00Z', 24 * hours],
    // The days the clocks change are 25 and 23 hours long.
    ['2026-10-24T23:00:00Z', 25 * hours],
    ['2026-03-29T00:00:00Z', 23 * hours],
  ])('from %s is %i ms', (now, expected) => {
    expect(msUntilLondonMidnight(new Date(now))).toBe(expected);
  });
});

describe('openFor', () => {
  // 9 Oct 2026, 13:00 in London (BST).
  const today = new Date('2026-10-09T12:00:00Z');

  it.each([
    ['2026-10-09T08:00:00Z', 'reported today'],
    // 00:30 on 9 Oct in London, though still 8 Oct in UTC.
    ['2026-10-08T23:30:00Z', 'reported today'],
    ['2026-10-08T12:00:00Z', 'reported yesterday'],
    ['2026-10-02T12:00:00Z', 'open 7 days'],
    ['2026-09-18T12:00:00Z', 'open 3 weeks'],
    ['2026-06-01T12:00:00Z', 'open 4 months'],
  ])('describes a ticket from %s as "%s"', (submittedAt, expected) => {
    expect(openFor(new Date(submittedAt), today)).toBe(expected);
  });

  it('counts calendar days across the end of British Summer Time', () => {
    // 25 Oct 2026 is 25 hours long.
    expect(
      openFor(new Date('2026-10-24T12:00:00Z'), new Date('2026-10-26T12:00:00Z'))
    ).toBe('open 2 days');
  });
});

const page = 'https://app.makespace.org/equipment/wood-shop-band-saw';
const today = new Date('2026-10-09T12:00:00Z');

describe('renderTroubleTicketsImage', () => {
  const model = {
    equipmentName: 'Band Saw',
    pageUrl: page,
    today,
    tickets: openTickets([
      ticket('Todo', new Date('2026-09-01'), 'Blade guide is loose'),
    ]),
  };

  it.each([
    [800, 480],
    [296, 128],
    [480, 800],
  ])('draws a %ix%i PNG', (width, height) => {
    const png = renderTroubleTicketsImage(model, width, height);
    expect(png.readUInt32BE(16)).toBe(width);
    expect(png.readUInt32BE(20)).toBe(height);
  });

  // A display redraws whenever the image changes, so the same tickets must
  // always come out as the same bytes.
  it('draws the same tickets identically every time', () => {
    expect(renderTroubleTicketsImage(model, 400, 300)).toEqual(
      renderTroubleTicketsImage(model, 400, 300)
    );
  });

  it('draws something different when the tickets change', () => {
    expect(renderTroubleTicketsImage(model, 400, 300)).not.toEqual(
      renderTroubleTicketsImage({...model, tickets: []}, 400, 300)
    );
  });

  // The date in the corner is the one clock: the image changes at midnight in
  // London, and only then.
  it('draws the same picture all day and a new one after midnight in London', () => {
    const at = (iso: string) =>
      renderTroubleTicketsImage({...model, today: new Date(iso)}, 400, 300);
    expect(at('2026-10-09T07:00:00Z')).toEqual(at('2026-10-09T22:30:00Z'));
    expect(at('2026-10-09T22:30:00Z')).not.toEqual(at('2026-10-09T23:30:00Z'));
  });

  it('draws a QR code to the page only on a panel with room for one', () => {
    const other = {...model, pageUrl: 'https://app.makespace.org/equipment/x'};
    expect(renderTroubleTicketsImage(model, 1280, 720)).not.toEqual(
      renderTroubleTicketsImage(other, 1280, 720)
    );
    expect(renderTroubleTicketsImage(model, 296, 128)).toEqual(
      renderTroubleTicketsImage(other, 296, 128)
    );
    expect(renderTroubleTicketsImage(model, 480, 800)).toEqual(
      renderTroubleTicketsImage(other, 480, 800)
    );
  });

  it('draws each headline differently', () => {
    const withAnswer = (answer: string | undefined) => ({
      ...model,
      tickets:
        answer === undefined
          ? []
          : openTickets([ticket('Todo', new Date('2026-09-01'), 'x', answer)]),
    });
    const answers = [
      'It is unsafe',
      "It's not working",
      'Consumables needed',
      undefined,
    ];
    const images = answers.map(answer =>
      renderTroubleTicketsImage(withAnswer(answer), 1280, 720).toString('base64')
    );
    expect(new Set(images).size).toBe(4);
    expect(() =>
      renderTroubleTicketsImage(withAnswer('It is unsafe'), 64, 64)
    ).not.toThrow();
  });

  it('copes with more tickets than fit, and titles longer than a line', () => {
    const many = {
      pageUrl: page,
      today,
      equipmentName: 'A machine with a name far too long to fit across a small panel',
      tickets: openTickets(
        Array.from({length: 30}, (_, i) =>
          ticket('Todo', new Date(2026, 0, i + 1), 'word '.repeat(80) + 'x'.repeat(200))
        )
      ),
    };
    expect(() => renderTroubleTicketsImage(many, 64, 64)).not.toThrow();
    expect(() => renderTroubleTicketsImage(many, 800, 480)).not.toThrow();
  });
});

describe('renderTroubleTicketsImage for a black-and-white panel', () => {
  const model = {
    equipmentName: 'Band Saw',
    pageUrl: page,
    today,
    tickets: openTickets([
      ticket('Todo', new Date('2026-09-01'), 'Blade guide is loose'),
      ticket('Needs Help', new Date('2026-09-02'), 'Fence will not lock'),
    ]),
  };

  // The PNG this renderer writes is one IHDR then one IDAT.
  const idat = (png: Buffer) => png.subarray(41, 41 + png.readUInt32BE(33));

  it('draws a 1-bit greyscale PNG: one bit, black or white, per pixel', () => {
    const png = renderTroubleTicketsImage(model, 1280, 720, 2);
    expect(png.readUInt32BE(16)).toBe(1280);
    expect(png.readUInt32BE(20)).toBe(720);
    expect(png[24]).toBe(1);
    expect(png[25]).toBe(0);
    expect(inflateSync(idat(png)).length).toBe((1280 / 8 + 1) * 720);
  });

  it('draws the same tickets identically every time', () => {
    expect(renderTroubleTicketsImage(model, 400, 300, 2)).toEqual(
      renderTroubleTicketsImage(model, 400, 300, 2)
    );
  });

  it('draws something different when the tickets change', () => {
    expect(renderTroubleTicketsImage(model, 400, 300, 2)).not.toEqual(
      renderTroubleTicketsImage({...model, tickets: []}, 400, 300, 2)
    );
  });

  it('leaves a display that does not ask with exactly the four-tone image', () => {
    const png = renderTroubleTicketsImage(model, 400, 300);
    expect(png).toEqual(renderTroubleTicketsImage(model, 400, 300, 4));
    expect(png[24]).toBe(2);
  });
});
