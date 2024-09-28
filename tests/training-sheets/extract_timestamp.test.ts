import * as O from 'fp-ts/Option';
import {extractTimestamp} from '../../src/training-sheets/google';
import {getRightOrFail} from '../helpers';

describe('Extract timestamp', () => {
  // Found some missing rows due to this timestamp:
  it('Extract problematic timestamp', () => {
    const timestamp = getRightOrFail(
      // Atlantic/Canary == UTC+1
      extractTimestamp('Atlantic/Canary')(O.some('7/16/2024 21:53:13'))
    );
    expect(timestamp).toStrictEqual(1721163193000);
  });
});
