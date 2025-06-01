import {sort} from 'fp-ts/lib/ReadonlyArray';
import * as S from 'fp-ts/string';
import {MemberLinking} from '../../../src/read-models/shared-state/member-linking';

describe('Group membership numbers', () => {
  const tests: {
    input: number[][];
    output: ReadonlyArray<ReadonlySet<number>>;
  }[] = [
    {
      input: [[1, 2]],
      output: [new Set([1, 2])],
    },
    {
      input: [
        [1, 2],
        [2, 3],
        [4, 5],
      ],
      output: [new Set([1, 2, 3]), new Set([4, 5])],
    },
    {
      input: [[1, 2], [2]],
      output: [new Set([1, 2])],
    },
    {
      input: [[1], [2], [3], [1, 3]],
      output: [new Set([1, 3]), new Set([2])],
    },
  ];

  tests.forEach((data, index) => {
    it(index.toString(), () => {
      const linking = new MemberLinking();
      for (const i of data.input) {
        linking.link(i);
      }
      const sorting = sort<ReadonlySet<number>>({
        compare: (a, b) =>
          S.Ord.compare(
            Array.from(a.values()).join(','),
            Array.from(b.values()).join(',')
          ),
        equals: (a, b) => a === b,
      });
      expect(sorting(linking.all())).toStrictEqual(sorting(data.output));
    });
  });
});
