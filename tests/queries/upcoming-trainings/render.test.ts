/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/upcoming-trainings/render';
import {
  UpcomingMeetupTraining,
  UpcomingTraining,
  ViewModel,
} from '../../../src/queries/upcoming-trainings/construct-view-model';

// Thursday 29 October 2026, midday in London.
const now = new Date('2026-10-29T12:00:00Z');
const at = (iso: string) => new Date(iso);

const appTraining = (
  startsAt: string,
  status: O.Option<'open' | 'booked'> = O.some('open')
): UpcomingTraining => ({
  equipment: {id: 'band-saw', name: 'Band Saw', areaName: 'Wood Shop'},
  session: {
    id: `session-${startsAt}` as UUID,
    startsAt: at(startsAt),
    endsAt: new Date(at(startsAt).getTime() + 2 * 60 * 60 * 1000),
    trainer: {memberNumber: 1, name: O.some('Nigel Barker')},
    spaces: 4,
    booked: 1,
    attendees: [],
    description: '',
    signUpsCloseAt: at(startsAt),
    cancelled: O.none,
    yourStatus: status,
  },
  trained: false,
  readiness: {tag: 'ready'},
});

const meetupTraining = (
  title: string,
  startsAt: string,
  machine: O.Option<{id: string; name: string; areaName: string}>
): UpcomingMeetupTraining => ({
  equipment: machine,
  meetup: {
    eventId: title,
    title,
    startsAt: at(startsAt),
    endsAt: new Date(at(startsAt).getTime() + 3 * 60 * 60 * 1000),
    url: 'https://www.meetup.com/makespace/events/1/',
    description: '',
    going: 2,
    maxTickets: 4,
    rsvpsClosed: false,
    equipmentId: O.map((m: {id: string}) => m.id)(machine),
  },
  trained: false,
  readiness: {tag: 'ready'},
});

const viewModel = (overrides: Partial<ViewModel> = {}): ViewModel => ({
  loggedIn: true,
  showingTrained: false,
  hiddenEquipment: 0,
  trainings: [appTraining('2026-10-30T17:00:00Z')],
  meetupTrainings: [
    meetupTraining(
      'Metal Lathe Training',
      '2026-11-03T18:00:00Z',
      O.some({id: 'lathe', name: 'Metal Lathe', areaName: 'Metal Shop'})
    ),
    meetupTraining('First Aid Training', '2026-11-29T09:00:00Z', O.none),
  ],
  ...overrides,
});

const page = (vm: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(vm, now);
  return body;
};

const textOf = (element: Element | null) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('the Get trained calendar', () => {
  it('keeps the filled button for signing up, the one real decision', () => {
    const buttons = [...page(viewModel()).querySelectorAll('.button')].map(
      textOf
    );
    expect(buttons).toStrictEqual(['Sign up']);
  });

  it('links each day in the overview to that day in the list', () => {
    const body = page(viewModel());
    const targets = [
      ...body.querySelectorAll('.training-overview a[href^="#"]'),
    ].map(link => link.getAttribute('href')!.slice(1));

    // The first aid training is listed apart, so its day points there.
    expect(targets).toStrictEqual([
      'day-2026-10-30',
      'day-2026-11-03',
      'other-trainings',
    ]);
    for (const target of targets) {
      expect(body.querySelector(`#${target}`)).not.toBeNull();
    }
  });

  it('keeps Meetup trainings that are not for a machine apart', () => {
    const body = page(viewModel());
    const other = body.querySelector('.training-other');

    expect(textOf(other)).toContain('First Aid Training');
    expect(textOf(other)).not.toContain('Metal Lathe');
    expect(
      textOf(body.querySelector('#day-2026-11-03'))
    ).toContain('Metal Lathe');
  });

  it('says how soon each day is, with times as timetables write them', () => {
    const body = page(viewModel());

    expect(textOf(body.querySelector('#day-2026-10-30 h2'))).toBe(
      'Friday 30 October Tomorrow'
    );
    expect(textOf(body.querySelector('#day-2026-11-03 h2'))).toBe(
      'Tuesday 3 November in 5 days'
    );
    expect(textOf(body.querySelector('#day-2026-10-30 .training-row__time'))).toBe(
      '17.00–19.00'
    );
  });

  it('asks somebody not logged in to log in, and brings them back', () => {
    const link = page(
      viewModel({
        loggedIn: false,
        trainings: [appTraining('2026-10-30T17:00:00Z', O.none)],
      })
    ).querySelector('.training-row__action a.button-outline');

    expect(textOf(link)).toBe('Log in to sign up');
    expect(link?.getAttribute('href')).toBe('/log-in?next=%2Ftraining');
  });
});
