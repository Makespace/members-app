/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {html} from '../../../src/types/html';
import {render} from '../../../src/queries/equipment-training/render';
import {ViewModel} from '../../../src/queries/equipment-training/construct-view-model';

const viewModel = (overrides: Partial<ViewModel> = {}): ViewModel => ({
  equipment: {
    id: 'eeeeeeee-0000-0000-0000-000000000001' as UUID,
    name: 'Band Saw',
    category: 'red',
  },
  area: {name: 'Wood Shop', email: O.some('woodshop-owners@example.com')},
  guideUrl: 'https://equipment.makespace.org/wood-shop/band-saw',
  progress: {tag: 'not-attempted'},
  trainers: [
    {
      memberNumber: 1234,
      name: O.some('A Trainer'),
      trainingsByQuarter: [
        {label: html`Q1 2026`, count: 0},
        {label: html`Q2 2026`, count: 2},
        {label: html`Q3 2026`, count: 1},
        {label: html`Q4 2026`, count: 0},
      ],
    },
  ],
  lastTraining: O.some(new Date('2026-08-11')),
  ...overrides,
});

const page = (vm: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(vm);
  return body;
};

const textOf = (vm: ViewModel) =>
  (page(vm).textContent ?? '').replace(/\s+/g, ' ');

describe('the get-trained page', () => {
  it('names the two steps in the order they happen', () => {
    const headings = [...page(viewModel()).querySelectorAll('h2')].map(node =>
      (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    );

    expect(headings).toStrictEqual([
      '1. Pass the online quiz',
      '2. Attend an in-person training session',
    ]);
  });

  it('sends people to the guide for the quiz', () => {
    const links = [...page(viewModel()).querySelectorAll('a')].map(
      node => node.getAttribute('href') ?? ''
    );

    expect(links).toContain(
      'https://equipment.makespace.org/wood-shop/band-saw'
    );
    expect(links).toContain('https://www.meetup.com/makespace/');
  });

  describe('what it tells the member about their own progress', () => {
    it('asks for the quiz when they have not taken it', () => {
      expect(textOf(viewModel())).toContain('You need to take the online quiz');
    });

    it('says they have not passed yet, with the score to beat', () => {
      const text = textOf(
        viewModel({
          progress: {
            tag: 'failed',
            score: 7,
            maxScore: 10,
            completedAt: new Date('2026-02-03'),
          },
        })
      );

      expect(text).toContain('not passed it yet');
      expect(text).toContain('7 out of 10');
    });

    it('moves them on to the practical once they have passed', () => {
      const text = textOf(
        viewModel({
          progress: {tag: 'passed', completedAt: new Date('2026-03-04')},
        })
      );

      expect(text).toContain('You passed the online quiz');
      expect(text).toContain('in-person training session');
    });

    it('tells a trained member there is nothing left to do', () => {
      const text = textOf(
        viewModel({progress: {tag: 'trained', since: new Date('2026-03-04')}})
      );

      expect(text).toContain('You are trained on this equipment');
    });

    it('is honest when the equipment has no quiz registered', () => {
      const text = textOf(viewModel({progress: {tag: 'no-quiz'}}));

      expect(text).toContain('No online quiz is registered');
    });
  });

  describe('what it says about the people who run practicals', () => {
    it('counts the active trainers and says what they are', () => {
      const text = textOf(viewModel());

      expect(text).toContain('has 1 active trainer.');
      expect(text).toContain('trainers are volunteers');
    });

    it('says when a training last happened here', () => {
      expect(textOf(viewModel())).toContain('Last training occurred');
      expect(textOf(viewModel())).toContain('11/08/2026');
    });

    it('is honest when nothing has happened yet', () => {
      const text = textOf(
        viewModel({trainers: [], lastTraining: O.none})
      );

      expect(text).toContain('No trainings recorded yet');
      expect(text).toContain('There are no active trainers for this equipment');
      // Who to ask, rather than a count of nobody.
      expect(text).toContain('management@makespace.org');
      expect(text).toContain('woodshop-owners@example.com');
      expect(text).not.toContain('0 active trainers');
    });

    it('draws each trainer a sparkline of what they have delivered', () => {
      expect(
        page(viewModel()).querySelectorAll('.training-trainers svg.sparkline')
      ).toHaveLength(1);
    });
  });

  // Nobody will book you a practical before you have passed the quiz, so the
  // step is dimmed until you have - visible, but plainly not your turn.
  describe('dimming the practical step until the quiz is passed', () => {
    const isDimmed = (vm: ViewModel) =>
      page(vm).querySelectorAll('.training-step--waiting').length === 1;

    it('dims it for a member who has not taken the quiz', () => {
      expect(isDimmed(viewModel())).toBe(true);
    });

    it('dims it for a member who has not passed', () => {
      expect(
        isDimmed(
          viewModel({
            progress: {
              tag: 'failed',
              score: 7,
              maxScore: 10,
              completedAt: new Date('2026-02-03'),
            },
          })
        )
      ).toBe(true);
    });

    it('lifts the dimming once they have passed', () => {
      expect(
        isDimmed(
          viewModel({
            progress: {tag: 'passed', completedAt: new Date('2026-03-04')},
          })
        )
      ).toBe(false);
    });

    it('lifts it for a member who is already trained', () => {
      expect(
        isDimmed(
          viewModel({progress: {tag: 'trained', since: new Date('2026-03-04')}})
        )
      ).toBe(false);
    });
  });

  it('names the address to email when no practical is scheduled', () => {
    expect(textOf(viewModel())).toContain('woodshop-owners@example.com');
  });

  it('falls back to the area when it has no address of its own', () => {
    const text = textOf(
      viewModel({area: {name: 'Wood Shop', email: O.none}})
    );

    expect(text).toContain('the owners of Wood Shop');
  });

  // An orange or green machine has no training to book, and a member who
  // scans their way here from somewhere should be told that, not walked
  // through steps that do not apply.
  it('says so when the equipment needs no training', () => {
    const text = textOf(
      viewModel({
        equipment: {
          id: 'eeeeeeee-0000-0000-0000-000000000001' as UUID,
          name: 'Hand Tools',
          category: 'green',
        },
      })
    );

    expect(text).toContain('There is no training to book');
    expect(text).not.toContain('Pass the online quiz');
  });
});
