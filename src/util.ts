import {Logger} from 'pino';

export const logPassThru =
  (logger: Logger, msg: string) =>
  <T>(input: T) => {
    logger.info(msg);
    return input;
  };

export const getChunkIndexes = (
  startInclusive: number,
  endInclusive: number,
  chunkSize: number
): [number, number][] => {
  const result: [number, number][] = [];
  let start = startInclusive;
  while (start < endInclusive) {
    let end = start + chunkSize;
    end = end > endInclusive ? endInclusive : end;
    result.push([start, end]);
    start = end + 1;
  }
  return result;
};
