import {ReadonlyNonEmptyArray} from 'fp-ts/lib/ReadonlyNonEmptyArray';
import {groupMembershipNumbers} from '../../../src/read-models/shared-state/member/group-membership-numbers';

describe('Group membership numbers', () => {
  const tests: {
    input: {
      a: number;
      b: number;
    }[];
    output: ReadonlyArray<ReadonlyNonEmptyArray<number>>;
  }[] = [
    {
      input: [
        {
          a: 1,
          b: 2,
        },
      ],
      output: [[1, 2]],
    },
    {
      input: [
        {
          a: 1,
          b: 2,
        },
        {
          a: 2,
          b: 3,
        },
        {
          a: 4,
          b: 5,
        },
      ],
      output: [
        [1, 2, 3],
        [4, 5],
      ],
    },
  ];

  tests.forEach((data, index) => {
    it(index.toString(), () => {
      expect(groupMembershipNumbers(data.input)).toStrictEqual(data.output);
    });
  });
});
