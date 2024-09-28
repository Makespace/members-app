import * as O from 'fp-ts/Option';
import {columnBoundsRequired} from '../../src/training-sheets/google';

describe('columnBoundsRequired', () => {
  [
    {
      input: {
        name: 'All populated',
        rowCount: 0,
        mappedColumns: {
          timestamp: 1,
          score: 0,
          email: O.some(3),
          memberNumber: O.some(2),
        },
      },
      expected: [0, 3],
    },
    {
      input: {
        name: 'Minimal required',
        rowCount: 0,
        mappedColumns: {
          timestamp: 1,
          score: 0,
          email: O.none,
          memberNumber: O.none,
        },
      },
      expected: [0, 1],
    },
    {
      input: {
        name: '1 populated',
        rowCount: 0,
        mappedColumns: {
          timestamp: 1,
          score: 4,
          email: O.none,
          memberNumber: O.some(0),
        },
      },
      expected: [0, 4],
    },
  ].forEach(({input, expected}) => {
    it(`${input.name}`, () => {
      expect(columnBoundsRequired(input)).toStrictEqual(expected);
    });
  });
});
