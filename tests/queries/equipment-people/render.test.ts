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
import {ViewModel} from '../../../src/queries/equipment-people/construct-view-model';

const equipmentId = 'eeeeeeee-0000-0000-0000-000000000001' as UUID;

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
  waiting: [
    {
      name: O.some('A Waiting Member'),
      memberNumber: 4321,
      primaryEmailAddress: O.some('waiting@example.com' as EmailAddress),
      waitingSince: new Date('2026-09-01'),
    },
  ],
  waitingUnknown: [
    {
      waitingSince: new Date('2026-09-02'),
      memberNumberProvided: O.none,
      emailProvided: O.some('someone@example.com'),
    },
  ],
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
    const results = () => page(renderQuizResults(viewModel()));

    it('offers a trainer the way to mark somebody trained', () => {
      expect(
        results().querySelectorAll('form[action="/equipment/mark-member-trained"]')
      ).toHaveLength(1);
    });

    // Quizzes passed by somebody the app could not match are people waiting
    // too, so they belong here rather than under the failures.
    it('keeps the unmatched passes with the rest of the passes', () => {
      const headings = [...results().querySelectorAll('h2')].map(node =>
        (node.textContent ?? '').trim()
      );

      expect(headings).toStrictEqual([
        'Waiting for training',
        'Waiting for training - unknown member',
      ]);
    });

    it('does not mention the failures', () => {
      expect(results().textContent).not.toContain('Failed');
    });

    it('says when the results were last pulled', () => {
      expect(results().textContent).toContain('Last refresh');
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
