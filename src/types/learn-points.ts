import * as t from 'io-ts';

// What a member should learn about one machine before using it, as short
// points printed under "Learn" on its sign. Kept to a few short lines: the
// sign is a postcard, and every line is taken from the space the other
// sections and the code need.
export const MAX_LEARN_POINTS = 5;
export const MAX_LEARN_POINT_LENGTH = 100;

// One point per line. Leading bullets are dropped, since people paste lists
// the way they would write them, and the sign draws its own.
export const parseLearnPoints = (
  text: string | undefined | null
): ReadonlyArray<string> =>
  (text ?? '')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(line => line !== '');

// The points as entered, normalised to one clean point per line; empty means
// "none", and the sign goes back to its general sentence.
export const learnPointsText = new t.Type<string, string, unknown>(
  'LearnPoints',
  (input): input is string => typeof input === 'string',
  (input, context) => {
    if (typeof input !== 'string') {
      return t.failure(input, context, 'The points must be text');
    }
    const points = parseLearnPoints(input);
    if (points.length > MAX_LEARN_POINTS) {
      return t.failure(
        input,
        context,
        `At most ${MAX_LEARN_POINTS} points fit on a sign`
      );
    }
    const tooLong = points.find(point => point.length > MAX_LEARN_POINT_LENGTH);
    if (tooLong !== undefined) {
      return t.failure(
        input,
        context,
        `Each point must be at most ${MAX_LEARN_POINT_LENGTH} characters`
      );
    }
    return t.success(points.join('\n'));
  },
  t.identity
);
