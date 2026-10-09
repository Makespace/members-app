import {
  ticketCardHtml,
  ticketLineHtml,
  TicketEmailSummary,
} from '../../src/templates/trouble-ticket-email';

// Email cannot reach the site's stylesheet, so a ticket in an email carries
// its own. These check it says the same things the card on the page does.

const summary: TicketEmailSummary = {
  title: 'The blade is blunt',
  status: 'Todo',
  equipmentName: 'Band Saw',
  areaName: 'Wood Shop',
  rawEquipment: null,
  reportedBy: 'A Member',
  reportedAt: new Date('2026-10-07T10:00:00Z'),
  machineStatus: 'Broken',
  attempting: 'Cutting plywood',
  issue: 'It will not cut straight',
  steps: 'Tried a new blade',
  url: 'https://members.makespace.org/trouble-tickets/view/abc',
};

describe('a trouble ticket in an email', () => {
  it('carries their own answers back to them', () => {
    const html = ticketCardHtml(summary);

    expect(html).toContain('It will not cut straight');
    expect(html).toContain('Tried a new blade');
    expect(html).toContain('Cutting plywood');
  });

  // The whole point of the ticket having an address.
  it('links to the ticket itself', () => {
    expect(ticketCardHtml(summary)).toContain(
      'https://members.makespace.org/trouble-tickets/view/abc'
    );
  });

  // Knowing the machine rarely tells somebody whether it is theirs; the area
  // is the half that does.
  it('names the machine and the area it is in', () => {
    const html = ticketCardHtml(summary);

    expect(html).toContain('Band Saw');
    expect(html).toContain('Wood Shop');
  });

  it('says where an unmatched ticket said it was', () => {
    const html = ticketCardHtml({
      ...summary,
      equipmentName: null,
      areaName: null,
      rawEquipment: 'the big green one',
    });

    expect(html).toContain('Unassigned');
    expect(html).toContain('the big green one');
  });

  // An empty answer would otherwise leave a labelled blank row.
  it('leaves out an answer nobody gave', () => {
    const html = ticketCardHtml({...summary, steps: '', attempting: '   '});

    expect(html).not.toContain('Steps taken');
    expect(html).not.toContain('Attempting');
    expect(html).toContain('Issue');
  });

  it('cannot be broken open by what somebody typed', () => {
    const html = ticketCardHtml({
      ...summary,
      issue: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  // A summary is for scanning, so the line is the short form: what happened,
  // where, and a way in.
  it('says what happened in a summary line, briefly', () => {
    const line = ticketLineHtml({...summary, happening: 'reported'});

    expect(line).toContain('The blade is blunt');
    expect(line).toContain('reported');
    expect(line).toContain('Band Saw');
    expect(line).toContain('https://members.makespace.org/trouble-tickets/view/abc');
    // The full answers belong on the ticket, not in a list of them.
    expect(line).not.toContain('Tried a new blade');
  });

  it('gives a ticket with no title something to click', () => {
    expect(ticketLineHtml({...summary, title: '', happening: 'reported'})).toContain(
      'Trouble ticket'
    );
  });
});
