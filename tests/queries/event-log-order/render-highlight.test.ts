/**
 * @jest-environment jsdom
 */

import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {DomainEvent, StoredDomainEvent} from '../../../src/types/domain-event';
import {systemActor} from '../../helpers';
import {analyzeTimeline} from '../../../src/queries/event-log-order/construct-view-model';
import {render} from '../../../src/queries/event-log-order/render';
import {ViewModel} from '../../../src/queries/event-log-order/view-model';

const HOUR = 3_600_000;
const BASE = Date.parse('2022-01-01T00:00:00.000Z');

const stored = (
  index: number,
  recordedAtMs: number,
  event: DomainEvent
): StoredDomainEvent => ({
  ...event,
  recordedAt: new Date(recordedAtMs),
  event_id: faker.string.uuid() as UUID,
  event_index: index as Int,
  deletedAt: null,
  deleteReason: null,
  markDeletedByMemberNumber: null,
});

const area = (): DomainEvent =>
  constructEvent('AreaCreated')({
    id: faker.string.uuid() as UUID,
    name: 'Area' as NonEmptyString,
    actor: systemActor(),
  });

const ticket = (submittedAtMs: number): DomainEvent =>
  constructEvent('TroubleTicketCreated')({
        source: 'sheet',
        equipmentId: null,
        machine: '',
    id: faker.string.uuid() as UUID,
    rowHash: faker.string.alphanumeric(64),
    sheetId: 'sheet',
    submittedAt: new Date(submittedAtMs),
    submittedMemberNumber: null,
    submittedEmail: null,
    submittedName: null,
    submittedEquipment: null,
    otherEquipmentDetail: '',
    status: '',
    attempting: '',
    issue: 'woven ticket',
    steps: '',
    actor: {tag: 'token', token: 'admin'},
  });

const buildViewModel = (highlightPrefix: string | null): ViewModel => {
  // A woven log: ticket events interleaved chronologically with area events.
  const events = [
    stored(1, BASE, area()),
    stored(2, BASE + 1 * HOUR, ticket(BASE + 1 * HOUR)),
    stored(3, BASE + 2 * HOUR, area()),
    stored(4, BASE + 3 * HOUR, ticket(BASE + 3 * HOUR)),
    stored(5, BASE + 4 * HOUR, area()),
  ];
  const {ordered: _ordered, ...analysis} = analyzeTimeline(events);
  return {...analysis, truncate: false, highlightPrefix, selected: null};
};

const renderPage = (vm: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(vm);
  return body;
};

describe('/event-log-order highlight', () => {
  it('marks matching events with dots at their positions', () => {
    const page = renderPage(buildViewModel('TroubleTicket'));
    const dots = page.querySelectorAll('svg circle');
    expect(dots).toHaveLength(2);
  });

  it('summarises the highlighted events and their block spread', () => {
    const page = renderPage(buildViewModel('TroubleTicket'));
    expect(page.textContent).toContain('2 TroubleTicket*');
    expect(page.textContent).toContain('of 1');
  });

  it('renders no highlight layer without the query param', () => {
    const page = renderPage(buildViewModel(null));
    expect(page.querySelectorAll('svg circle')).toHaveLength(0);
    expect(page.textContent).not.toContain('Highlighting');
  });

  it('reports a prefix that matches nothing', () => {
    const page = renderPage(buildViewModel('Nonexistent'));
    expect(page.textContent).toContain('no matching events');
  });
});
