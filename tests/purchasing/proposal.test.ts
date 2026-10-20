import * as E from 'fp-ts/Either';
import {
  normaliseProposal,
  typedProposal,
} from '../../src/purchasing/proposal';
import {getRightOrFail} from '../helpers';

const raw = {
  need: ' Our planer is dangerous ',
  options: [
    {description: 'Replace it', pros: 'Safe', cons: 'Costly', cost: '1200'},
    {description: '', pros: '', cons: '', cost: ''},
    {description: 'Repair it', pros: 'Cheap', cons: 'Short-lived', cost: '300.50'},
  ],
  preferred: 'Replace it - repairs keep failing',
  risks: [
    {
      hazard: 'Kickback',
      harm: 'The user, badly',
      severity: '4',
      probability: '3',
      actions: 'Guards and training',
      residualSeverity: '4',
      residualProbability: '1',
    },
  ],
  location: 'Where the old one is',
  owner: '',
  training: ' Induction for all users ',
};

const problem = (fields: object, needsRiskAssessment = false) => {
  const result = normaliseProposal(
    typedProposal({...raw, ...fields}),
    needsRiskAssessment
  );
  return E.isLeft(result) ? result.left : 'no problem';
};

describe('proposals', () => {
  it('reads the proposal, leaving out blank options and what was not given', () => {
    expect(
      getRightOrFail(normaliseProposal(typedProposal(raw), true))
    ).toStrictEqual({
      need: 'Our planer is dangerous',
      options: [
        {description: 'Replace it', pros: 'Safe', cons: 'Costly', costPence: 120_000},
        {description: 'Repair it', pros: 'Cheap', cons: 'Short-lived', costPence: 30_050},
      ],
      preferred: 'Replace it - repairs keep failing',
      risks: [
        {
          hazard: 'Kickback',
          severity: 4,
          probability: 3,
          actions: 'Guards and training',
          residualSeverity: 4,
          residualProbability: 1,
          harm: 'The user, badly',
        },
      ],
      location: 'Where the old one is',
      owner: null,
      trainingAndServicing: 'Induction for all users',
    });
  });

  it('leaves out a risk assessment that is not needed', () => {
    expect(
      getRightOrFail(normaliseProposal(typedProposal(raw), false)).risks
    ).toStrictEqual([]);
  });

  it('reads lists keyed by index in order', () => {
    expect(
      typedProposal({
        options: {
          '22': {description: 'Second'},
          '3': {description: 'First'},
        },
      }).options.map(option => option.description)
    ).toStrictEqual(['First', 'Second']);
  });

  it.each([
    [{need: ' '}, 'Proposal: please describe the need.'],
    [{options: []}, 'Proposal: please give at least one option.'],
    [
      {options: [{description: '', cost: '5'}]},
      'Option 1: please describe the option.',
    ],
    [
      {options: [{description: 'A'}]},
      'Option 1: please say what it would cost.',
    ],
    [
      {options: [{description: 'A', cost: 'lots'}]},
      'Option 1: the cost should be in pounds, e.g. 630.00.',
    ],
    [{preferred: ''}, 'Proposal: please say which option you prefer, and why.'],
  ])('turns down %j', (fields, message) => {
    expect(problem(fields)).toBe(message);
  });

  it('needs a risk assessment when there is a health and safety risk', () => {
    expect(problem({risks: []}, true)).toBe(
      'Proposal: please assess the health and safety risks, with what will be done about each.'
    );
    const rated = {
      hazard: 'Dust',
      severity: '3',
      probability: '4',
      actions: 'Extraction',
      residualSeverity: '3',
      residualProbability: '2',
    };
    expect(problem({risks: [{...rated, actions: ''}]}, true)).toBe(
      'Risk 1: please say what will be done to reduce the risk.'
    );
    expect(problem({risks: [{...rated, hazard: ''}]}, true)).toBe(
      'Risk 1: please say what the hazard is.'
    );
    expect(problem({risks: [{...rated, severity: ''}]}, true)).toBe(
      'Risk 1: please rate how bad it would be, from 1 to 5.'
    );
    expect(problem({risks: [{...rated, probability: '6'}]}, true)).toBe(
      'Risk 1: please rate how likely it is, from 1 to 5.'
    );
    expect(problem({risks: [{...rated, residualSeverity: '0'}]}, true)).toBe(
      'Risk 1: please rate how bad it would be once those actions are taken, from 1 to 5.'
    );
    expect(problem({risks: [{...rated, residualProbability: 'x'}]}, true)).toBe(
      'Risk 1: please rate how likely it would be once those actions are taken, from 1 to 5.'
    );
  });
});
