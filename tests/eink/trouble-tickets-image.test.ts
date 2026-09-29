import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {
  openTickets,
  renderTroubleTicketsImage,
} from '../../src/eink/trouble-tickets-image';
import {TroubleTicket, TroubleTicketStatus} from '../../src/types/trouble-ticket';

const ticket = (
  status: TroubleTicketStatus,
  submittedAt: Date,
  title = faker.lorem.sentence()
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
  assignedMemberNumbers: [],
  response: {
    otherEquipmentDetail: '',
    status: '',
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
      'status',
      'submittedAt',
      'title',
    ]);
  });
});

describe('renderTroubleTicketsImage', () => {
  const model = {
    equipmentName: 'Band Saw',
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

  it('copes with more tickets than fit, and titles longer than a line', () => {
    const many = {
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
