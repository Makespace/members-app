import {ReadonlyNonEmptyArray} from 'fp-ts/lib/ReadonlyNonEmptyArray';
import {MemberLinking} from '../../../src/read-models/shared-state/member-linking';

describe('Group membership numbers', () => {
  const tests: {
    input: number[][];
    output: ReadonlyArray<ReadonlyNonEmptyArray<number>>;
  }[] = [
    {
      input: [[1, 2]],
      output: [[1, 2]],
    },
    {
      input: [
        [1, 2],
        [2, 3],
        [4, 5],
      ],
      output: [
        [1, 2, 3],
        [4, 5],
      ],
    },
  ];

  tests.forEach((data, index) => {
    it(index.toString(), () => {
      const linking = new MemberLinking();
      for (const i of data.input) {
        linking.link(i);
      }
      expect(linking.all()).toStrictEqual(data.output);
    });
  });
});
