/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {runInNewContext} from 'node:vm';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {ticketCard} from '../../src/templates/trouble-ticket-card';
import {TroubleTicketView} from '../../src/queries/trouble-tickets/view-model';
import {TroubleTicketStatus} from '../../src/types/trouble-ticket';

// The card is how a ticket is drawn on its own page, with everything the
// board's one-line row leaves out: the form's answers, the change log and
// the actions.
const ticket = (
  overrides: Partial<TroubleTicketView> = {}
): TroubleTicketView => ({
  id: faker.string.uuid() as UUID,
  permission: 'area-owner',
  plusOneCount: 0,
  hasPlusOne: false,
  title: 'Bandsaw is making a noise',
  status: 'Todo' as TroubleTicketStatus,
  submittedAt: new Date('2026-09-01T10:00:00.000Z'),
  submittedName: 'Sam Submitter',
  submittedMemberNumber: 42,
  providedMemberNumber: null,
  submittedEmail: 'sam@example.com',
  mailboxConversationId: null,
  equipmentName: O.some('Bandsaw'),
  equipmentCategory: O.some('red' as const),
  areaName: O.some('Wood Shop'),
  rawEquipment: 'Bandsaw',
  response: {
    otherEquipmentDetail: '',
    status: 'Broken',
    attempting: 'cutting',
    issue: 'noise',
    steps: '',
  },
  assignees: [],
  assignedToMe: false,
  inMyOwnerArea: true,
  onMyTrainerMachine: false,
  managementOnly: false,
  canChangeStatus: true,
  canAssignOthers: false,
  changeLog: [],
  ...overrides,
});

// ticketCard returns an Html string, not a page document.
const renderCard = (view: TroubleTicketView) => {
  const body = document.createElement('body');
  body.innerHTML = ticketCard(view);
  return body;
};

describe('ticket visibility dropdown', () => {
  const renderEditableCard = () => {
    document.body.innerHTML = ticketCard(ticket());
    const script = document.querySelector<HTMLScriptElement>('.tt-visibility-field script')!;
    const currentScript = jest.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
    try {
      runInNewContext(script.textContent ?? '', {document});
    } finally {
      currentScript.mockRestore();
    }
    return document.body;
  };

  afterEach(() => document.body.replaceChildren());

  it('lets an editor choose one group directly below Assigned and save it', () => {
    const view = ticket({permission: 'area-owner'});
    const card = renderCard(view);
    const form = card.querySelector<HTMLFormElement>('form.tt-visibility')!;
    const select = form.querySelector<HTMLSelectElement>('select[name="permission"]')!;
    expect(form.method).toBe('post');
    expect(new URL(form.action).pathname).toBe('/trouble-tickets/set-permission');
    expect(select.labels?.[0].textContent).toContain('Visibility:');
    expect(select.value).toBe('area-owner');
    expect(Array.from(select.options, option => option.value)).toEqual([
      'everybody', 'area-owner', 'manager',
    ]);
    expect(form.parentElement?.previousElementSibling?.tagName).toBe('BR');
    expect(form.parentElement?.parentElement?.textContent).toMatch(/Assigned:[\s\S]*Visibility:/);
    expect(card.querySelector('a[aria-label="Change visibility"]')).toBeNull();
    select.value = 'manager';
    const data = new FormData(form);
    expect(data.get('ticketId')).toBe(view.id);
    expect(data.getAll('permission')).toEqual(['manager']);
    expect(form.querySelector('button[type="submit"]')?.textContent).toBe('Save');
    expect(form.closest('p')).toBeNull();
  });

  it('shows text until Edit is clicked, and Cancel discards the unsaved selection', () => {
    const card = renderEditableCard();
    const form = card.querySelector<HTMLFormElement>('.tt-visibility')!;
    const display = card.querySelector<HTMLDivElement>('.tt-visibility__display')!;
    const edit = card.querySelector<HTMLAnchorElement>('.tt-visibility__edit')!;
    const select = form.querySelector('select')!;
    const submit = jest.fn();
    form.addEventListener('submit', submit);

    expect(form.hidden).toBe(true);
    expect(display.hidden).toBe(false);
    expect(display.textContent).toContain('Area Owners');
    edit.click();
    expect(form.hidden).toBe(false);
    expect(display.hidden).toBe(true);
    expect(edit.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(select);

    select.value = 'manager';
    form.querySelector<HTMLButtonElement>('.tt-visibility__cancel')!.click();
    expect(form.hidden).toBe(true);
    expect(display.hidden).toBe(false);
    expect(edit.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(edit);
    expect(submit).not.toHaveBeenCalled();

    edit.click();
    expect(select.value).toBe('area-owner');
  });

  it('cancels editing with Escape and returns focus to Edit', () => {
    const card = renderEditableCard();
    const edit = card.querySelector<HTMLAnchorElement>('.tt-visibility__edit')!;
    const form = card.querySelector<HTMLFormElement>('.tt-visibility')!;
    const select = form.querySelector('select')!;
    edit.click();
    select.value = 'everybody';
    select.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));

    expect(form.hidden).toBe(true);
    expect(select.value).toBe('area-owner');
    expect(document.activeElement).toBe(edit);
  });

  it('selects the ticket’s current management visibility', () => {
    const card = renderCard(ticket({permission: 'manager'}));
    expect(card.querySelector<HTMLSelectElement>('select[name="permission"]')?.value).toBe('manager');
  });

  it('shows visibility without an editor for members who cannot change it', () => {
    const card = renderCard(ticket({canChangeStatus: false, permission: 'everybody'}));
    expect(card.querySelector('.tt-visibility')).toBeNull();
    expect(card.textContent).toContain('Everybody');
  });
});

describe('ticket +1 button', () => {
  it('lets a reader vote from the header and return to the ticket', () => {
    const view = ticket({canChangeStatus: false, plusOneCount: 3});
    const card = renderCard(view);
    const form = card.querySelector<HTMLFormElement>('.tt-card__header form')!;
    const button = form.querySelector('button')!;
    expect(form.method).toBe('post');
    const action = new URL(form.action);
    expect(action.pathname).toBe('/trouble-tickets/set-plus-one');
    expect(action.searchParams.get('next')).toBe(`/trouble-tickets/view/${view.id}`);
    expect(form.querySelector('input[name="ticketId"]')?.getAttribute('value')).toBe(view.id);
    expect(form.querySelector('input[name="plusOne"]')?.getAttribute('value')).toBe('true');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toContain('3 votes');
    expect(button.querySelector('img')?.getAttribute('src')).toBe('/static/makespace-plus-one.svg');
    expect(button.textContent?.trim()).toBe('3');
  });

  it('shows the selected state and submits removal when already voted', () => {
    const card = renderCard(ticket({hasPlusOne: true, plusOneCount: 1}));
    const button = card.querySelector('.tt-plus-one button')!;
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toContain('Remove your +1');
    expect(card.querySelector('input[name="plusOne"]')?.getAttribute('value')).toBe('false');
  });
});

// A ticket raised from the mailbox is one step removed from the email that
// prompted it, where the sender's own words and any reply live.
describe('where a ticket came from', () => {
  const cardFor = (overrides: Partial<TroubleTicketView>) =>
    renderCard(ticket(overrides));

  it('links a ticket raised from the mailbox back to its conversation', () => {
    const link = cardFor({
      mailboxConversationId: 'first-message',
    }).querySelector('a[href^="/mailbox/"]');

    expect(link?.getAttribute('href')).toBe('/mailbox/first-message');
    expect(link?.textContent?.trim()).toBe('an email in the mailbox');
  });

  it('says nothing of the mailbox for a ticket raised any other way', () => {
    const card = cardFor({mailboxConversationId: null});

    expect(card.querySelector('a[href^="/mailbox/"]')).toBeNull();
    expect(card.textContent).not.toContain('Raised from');
  });
});

// An owner reading a ticket usually wants to know who this is and what else
// they are trained on, which is one click away if the name is a link.
describe('who submitted a ticket', () => {
  const cardFor = (overrides: Partial<TroubleTicketView>) =>
    renderCard(ticket(overrides));

  it('links a matched member to their record, by name and by number', () => {
    const links = [
      ...cardFor({
        submittedName: 'Sam Submitter',
        submittedMemberNumber: 42,
      }).querySelectorAll('a[href="/member/42"], a[href="/member/42/"]'),
    ].map(node => (node.textContent ?? '').trim());

    expect(links).toContain('Sam Submitter');
    expect(links).toContain('42');
  });

  it('leaves what they typed as plain text when nobody matched', () => {
    const card = cardFor({
      submittedName: 'Someone Unmatched',
      submittedMemberNumber: null,
    });

    expect(card.textContent).toContain('Someone Unmatched');
    expect(card.querySelector('a[href^="/member/"]')).toBeNull();
  });

  it('falls back to the address when there is no name', () => {
    const card = cardFor({
      submittedName: null,
      submittedEmail: 'someone@example.com',
      submittedMemberNumber: 42,
    });

    expect(
      card.querySelector('a[href="/member/42"]')?.textContent?.trim()
    ).toBe('someone@example.com');
  });

  it('says so when the form carried nothing at all', () => {
    expect(
      cardFor({
        submittedName: null,
        submittedEmail: null,
        submittedMemberNumber: null,
      }).textContent
    ).toContain('Not provided');
  });
});

// Status changes require confirmation showing who will be emailed.
describe('trouble ticket card actions', () => {
  it('offers no one-click resolve; status actions go through their pages', () => {
    const dom = renderCard(ticket());

    expect(dom.querySelector('form.tt-quiet-resolve')).toBeNull();
    expect(dom.querySelectorAll('form:not(.tt-plus-one):not(.tt-visibility)')).toHaveLength(0);
    expect(
      dom.querySelector('a[href^="/trouble-tickets/resolve?"]')
    ).not.toBeNull();
  });

  it('says on each action who it will email', () => {
    const hints = [
      ...renderCard(ticket({status: 'In Progress'})).querySelectorAll(
        'a.tt-action'
      ),
    ].map(link => link.getAttribute('title') ?? '');

    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) {
      expect(hint).toMatch(/^Emails the submitter/);
    }
    expect(hints).toContain("Emails the submitter and the machine's trainers");
  });

  it('offers no actions on a resolved ticket, nor to a viewer who cannot act', () => {
    expect(
      renderCard(ticket({status: 'Resolved'})).querySelector('a.tt-action')
    ).toBeNull();
    expect(
      renderCard(ticket({canChangeStatus: false})).querySelector('a.tt-action')
    ).toBeNull();
  });
});

// The change log says who was told about each change, so nobody has to
// wonder whether an email went out or to whom.
describe('what the change log says about emails', () => {
  const entry = (over: Partial<TroubleTicketView['changeLog'][number]>) => ({
    at: new Date('2026-09-02T10:00:00.000Z'),
    actor: 'Tara Trainer',
    summary: 'marked this ticket as Resolved',
    details: [],
    status: 'Resolved' as TroubleTicketStatus,
    emailedTo: null,
    quiet: false,
    ...over,
  });

  const logOf = (over: Partial<TroubleTicketView['changeLog'][number]>) =>
    renderCard(ticket({changeLog: [entry(over)]})).querySelector('.tt-emailed');

  it('names who was emailed', () => {
    expect(logOf({emailedTo: ['sam@example.com']})?.textContent?.trim()).toBe(
      'Emailed sam@example.com'
    );
  });

  it('says when nobody could be emailed', () => {
    expect(logOf({emailedTo: []})?.textContent?.trim()).toBe(
      'No email sent: nobody had a usable address.'
    );
  });

  it('says when a resolve was quiet by choice', () => {
    expect(logOf({emailedTo: null, quiet: true})?.textContent?.trim()).toBe(
      'No email sent: resolved quietly.'
    );
  });

  it('says nothing while an email is still to be sent', () => {
    expect(logOf({emailedTo: null, quiet: false})).toBeNull();
  });
});

// On the ticket's own page the history is the point, so it starts open.
describe('the change log on a ticket', () => {
  it('starts open', () => {
    const log = renderCard(
      ticket({
        changeLog: [
          {
            at: new Date('2026-09-02T10:00:00.000Z'),
            actor: 'Tara Trainer',
            summary: 'marked this ticket as Resolved',
            details: [],
            status: 'Resolved' as TroubleTicketStatus,
            emailedTo: null,
            quiet: false,
          },
        ],
      })
    ).querySelector('details.tt-changelog');

    expect(log?.hasAttribute('open')).toBe(true);
  });
});

// Only the management team and super-users can see one of these; the card
// says so, so nobody takes it for something every owner can read.
describe('a management-only ticket', () => {
  it('is marked as private', () => {
    expect(
      renderCard(ticket({managementOnly: true}))
        .querySelector('.tt-private')
        ?.textContent?.trim()
    ).toBe('Management only');
  });

  it('leaves every other ticket unmarked', () => {
    expect(
      renderCard(ticket({managementOnly: false})).querySelector('.tt-private')
    ).toBeNull();
  });
});

// Handing a ticket to somebody else is for super-users, for now.
describe('assigning a ticket to someone else', () => {
  const assignToLink = (overrides: Partial<TroubleTicketView>) =>
    renderCard(ticket(overrides)).querySelector(
      'a[href^="/trouble-tickets/assign-to?"]'
    );

  it('is offered to a super-user on an open ticket', () => {
    expect(
      assignToLink({canAssignOthers: true, status: 'Todo'})?.textContent?.trim()
    ).toBe('Assign to…');
    expect(
      assignToLink({canAssignOthers: true, status: 'In Progress'})
    ).not.toBeNull();
  });

  it('is not offered to anybody else', () => {
    expect(assignToLink({canAssignOthers: false})).toBeNull();
  });

  it('is not offered on a resolved ticket', () => {
    expect(
      assignToLink({canAssignOthers: true, status: 'Resolved'})
    ).toBeNull();
  });
});
