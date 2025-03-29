import {getChunkIndexes} from '../../src/util';

describe('Get chunk indexes', () => {
  [
    [2, 240, 500, [[2, 240]]],
    [
      2,
      2000,
      500,
      [
        [2, 502],
        [503, 1003],
        [1004, 1504],
        [1505, 2000],
      ],
    ],
    [2, 1, 500, []],
    [1000, 2, 500, []],
  ].forEach(([start, end, chunkSize, expected]) => {
    it(`${start.toString()}:${end.toString()}:${chunkSize.toString()}`, () => {
      expect(
        getChunkIndexes(start as number, end as number, chunkSize as number)
      ).toStrictEqual(expected);
    });
  });
});
