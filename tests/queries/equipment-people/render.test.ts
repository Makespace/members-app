/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {EmailAddress} from '../../../src/types';
import {
  renderFailedQuizzes,
  renderQuizResults,
  renderTrainedUsers,
} from '../../../src/queries/equipment-people/render';
import {
  TrainingRow,
  ViewModel,
} from '../../../src/queries/equipment-people/construct-view-model';

const equipmentId = 'eeeeeeee-0000-0000-0000-000000000001' as UUID;

const waitingMember: TrainingRow = {
  kind: 'member',
  person: {
    name: O.some('A Waiting Member'),
    memberNumber: 4321,
    primaryEmailAddress: O.some('waiting@example.com' as EmailAddress),
  },
  standing: {kind: 'passed', at: new Date('2026-09-01')},
};

const unknownPass: TrainingRow = {
  kind: 'unknown',
  waitingSince: new Date('2026-09-02'),
  memberNumberProvided: O.some(999999),
  emailProvided: O.some('someone@example.com'),
  possibleMatch: O.none,
};

const viewModel = (overrides: Partial<ViewModel> = {}): ViewModel => ({
  equipment: {id: equipmentId, name: 'Band Saw'},
  isTrainer: true,
  isTrainerOrOwner: true,
  trained: [
    {
      name: O.some('A Trained Member'),
      memberNumber: 1234,
      primaryEmailAddress: 'trained@example.com' as EmailAddress,
      trainedSince: new Date('2026-03-04'),
      trainedByMemberNumber: O.some(99),
    },
  ].map(member => ({
    ...member,
    primaryEmailAddress: O.some(member.primaryEmailAddress),
  })),
  waiting: [unknownPass, waitingMember],
  search: O.none,
  failed: [
    {
      completedAt: new Date('2026-09-03'),
      memberNumberProvided: O.some(5555),
      emailProvided: O.none,
      score: 4,
      maxScore: 10,
      percentage: 40,
      trainingSheetId: 'a-sheet',
    },
  ],
  lastQuizSync: O.some(new Date('2026-09-04')),
  ...overrides,
});

const page = (markup: string) => {
  const body = document.createElement('body');
  body.innerHTML = markup;
  return body;
};

describe('the people pages for a machine', () => {
  describe('currently trained users', () => {
    it('shows a member as one cell: name, number and address', () => {
      const cell = page(renderTrainedUsers(viewModel())).querySelector('td');

      expect(cell?.textContent).toContain('A Trained Member');
      expect(cell?.textContent).toContain('1234');
      expect(cell?.textContent).toContain('trained@example.com');
    });

    it('offers a trainer the way to revoke it', () => {
      const forms = page(renderTrainedUsers(viewModel())).querySelectorAll(
        'form[action="/equipment/revoke-member-trained"]'
      );

      expect(forms).toHaveLength(1);
    });

    // An owner reads the list; revoking is the trainer's to do.
    it('leaves that out for anybody else', () => {
      const body = page(
        renderTrainedUsers(viewModel({isTrainer: false}))
      );

      expect(
        body.querySelectorAll('form[action="/equipment/revoke-member-trained"]')
      ).toHaveLength(0);
    });

    it('keeps addresses from people who are only reading', () => {
      const body = page(
        renderTrainedUsers(
          viewModel({isTrainer: false, isTrainerOrOwner: false})
        )
      );

      expect(body.textContent).toContain('A Trained Member');
      expect(body.textContent).not.toContain('trained@example.com');
    });

    it('says so when nobody is trained', () => {
      expect(page(renderTrainedUsers(viewModel({trained: []}))).textContent).
        toContain('Nobody is currently trained');
    });

    it('leads back to the machine', () => {
      const links = [
        ...page(renderTrainedUsers(viewModel())).querySelectorAll('a'),
      ].map(node => node.getAttribute('href') ?? '');

      expect(links).toContain(`/equipment/${equipmentId}`);
    });
  });

  describe('training quiz results', () => {
    const results = (overrides: Partial<ViewModel> = {}) =>
      page(renderQuizResults(viewModel(overrides)));

    it('offers a trainer the way to mark somebody trained', () => {
      expect(
        results().querySelectorAll(
          'form.training-mark[action^="/equipment/mark-member-trained"]'
        )
      ).toHaveLength(1);
    });

    // Back to this page, not to the areas page, once the press has landed.
    it('sends the press back to this page', () => {
      const form = results().querySelector('form.training-mark');

      expect(form?.getAttribute('action')).toBe(
        `/equipment/mark-member-trained?next=${encodeURIComponent(
          `/equipment/${equipmentId}/quiz-results`
        )}`
      );
    });

    it('keeps the search in the way back', () => {
      const form = results({
        search: O.some({query: 'a waiting', results: [waitingMember]}),
      }).querySelector('form.training-mark');

      expect(form?.getAttribute('action')).toBe(
        `/equipment/mark-member-trained?next=${encodeURIComponent(
          `/equipment/${equipmentId}/quiz-results?q=a%20waiting`
        )}`
      );
    });

    // Quizzes passed by somebody the app could not match are people waiting
    // too, so they sit in the same table as everybody else.
    it('keeps the unmatched passes in the one waiting table', () => {
      const body = results();
      const headings = [...body.querySelectorAll('h2')].map(node =>
        (node.textContent ?? '').trim()
      );
      const rows = body.querySelectorAll('.training-table tr');

      expect(headings).toStrictEqual(['Waiting for training']);
      // A header row, the unknown pass and the known member.
      expect(rows).toHaveLength(3);
    });

    it('marks an unmatched pass with the number as typed and a ?', () => {
      const row = results().querySelector('tr.training-row--unknown');

      expect(row?.querySelector('a[href="/member/999999/"]')).not.toBeNull();
      expect(row?.textContent).toContain('?');
      expect(row?.textContent).toContain('no member has this number');
      expect(row?.textContent).toContain('someone@example.com');
      // Nobody to mark: the button is there but cannot be pressed.
      const button = row?.querySelector('button');
      expect(button?.hasAttribute('disabled')).toBe(true);
      expect(row?.querySelector('form')).toBeNull();
    });

    it('says whose address an unmatched pass carries, when it is somebody\'s', () => {
      const row = results({
        waiting: [
          {
            ...unknownPass,
            possibleMatch: O.some({
              name: O.some('A Real Member'),
              memberNumber: 4321,
              primaryEmailAddress: O.some('someone@example.com' as EmailAddress),
            }),
          },
        ],
      }).querySelector('tr.training-row--unknown');

      expect(row?.textContent).toContain('Might be A Real Member');
      expect(row?.querySelector('a[href="/member/4321/"]')).not.toBeNull();
    });

    it('names the machine and the list in one heading', () => {
      expect(results().querySelector('h1')?.textContent?.trim()).toBe(
        'Band Saw training quiz results'
      );
    });

    // The search belongs to the waiting list: it sits under that heading,
    // and what it finds is shown above, in the same shape.
    it('puts the search box under the waiting-for-training heading', () => {
      const body = results();
      const heading = [...body.querySelectorAll('h2')].find(
        node => node.textContent?.trim() === 'Waiting for training'
      );

      expect(
        heading?.nextElementSibling?.classList.contains('training-search')
      ).toBe(true);
    });

    it('does not mention the failures', () => {
      expect(results().textContent).not.toContain('Failed');
    });

    it('says when the results were last pulled', () => {
      expect(results().textContent).toContain('Last refresh');
    });

    it('carries the page script only for somebody who can press the button', () => {
      expect(results().querySelector('script')).not.toBeNull();
      expect(results({isTrainer: false}).querySelector('script')).toBeNull();
    });

    describe('the search', () => {
      it('offers a search box that keeps what was typed', () => {
        const input = results({
          search: O.some({query: 'sam', results: []}),
        }).querySelector<HTMLInputElement>('form.training-search input[name="q"]');

        expect(input?.value).toBe('sam');
        expect(input?.getAttribute('placeholder')).toBe(
          'Member number, name or email'
        );
      });

      it('says so when nobody matches', () => {
        expect(
          results({search: O.some({query: 'zzz', results: []})}).textContent
        ).toContain('Nobody matches “zzz”');
      });

      it('shows a match who has passed with the button ready', () => {
        const table = results({
          search: O.some({query: 'waiting', results: [waitingMember]}),
        }).querySelectorAll('.training-table')[0];

        expect(table.textContent).toContain('A Waiting Member');
        expect(
          table.querySelector('form.training-mark button')?.hasAttribute('disabled')
        ).toBe(false);
      });

      // Somebody who matches the search but has not passed is still shown:
      // an empty table would not say whether the search or the person failed.
      it('shows a match who has not passed, with the button greyed out', () => {
        const table = results({
          search: O.some({
            query: 'newcomer',
            results: [
              {
                kind: 'member',
                person: {
                  name: O.some('A Newcomer'),
                  memberNumber: 7777,
                  primaryEmailAddress: O.some('new@example.com' as EmailAddress),
                },
                standing: {kind: 'not-passed'},
              },
            ],
          }),
        }).querySelectorAll('.training-table')[0];
        const button = table.querySelector('button.training-mark__disabled');

        expect(table.textContent).toContain('A Newcomer');
        expect(table.textContent).toContain('No pass in the last year');
        expect(button?.hasAttribute('disabled')).toBe(true);
        expect(button?.getAttribute('title')).toBe(
          'They have not passed the quiz yet'
        );
        expect(table.querySelector('form.training-mark')).toBeNull();
      });

      it('shows a match who is already trained as such', () => {
        const table = results({
          search: O.some({
            query: 'trained',
            results: [
              {
                kind: 'member',
                person: {
                  name: O.some('A Trained Member'),
                  memberNumber: 1234,
                  primaryEmailAddress: O.some(
                    'trained@example.com' as EmailAddress
                  ),
                },
                standing: {kind: 'trained', since: new Date('2026-03-04')},
              },
            ],
          }),
        }).querySelectorAll('.training-table')[0];

        expect(table.textContent).toContain('Already trained');
        const button = table.querySelector('button.training-mark__disabled');
        expect(button?.textContent?.trim()).toBe('Trained');
        expect(button?.hasAttribute('disabled')).toBe(true);
      });

      // One table: the search narrows it, and a link widens it again.
      it('narrows the one table to the matches, with the way back to everyone', () => {
        const body = results({
          search: O.some({query: 'zzz', results: []}),
        });

        expect(body.querySelectorAll('.training-table')).toHaveLength(0);
        expect(body.textContent).not.toContain('A Waiting Member');
        expect(
          body.querySelector(
            `a[href="/equipment/${equipmentId}/quiz-results"]`
          )?.textContent
        ).toBe('Show everyone waiting');
      });
    });
  });

  describe('failed quizzes', () => {
    it('lists the attempt with its score', () => {
      const body = page(renderFailedQuizzes(viewModel()));

      expect(body.textContent).toContain('5555');
      expect(body.textContent).toContain('4 / 10 (40%)');
    });

    it('says so when there are none', () => {
      expect(
        page(renderFailedQuizzes(viewModel({failed: []}))).textContent
      ).toContain('Nobody has failed the quiz recently');
    });
  });
});
