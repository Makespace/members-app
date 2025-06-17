import {getRightOrFail} from '../helpers';
import {extractTimestamp} from '../../src/sync-worker/google/util';

describe('Extract timestamp', () => {
  // Found some missing rows due to this timestamp:
  it('Extract problematic timestamp', () => {
    const timestamp = getRightOrFail(
      // Atlantic/Canary == UTC+1
      extractTimestamp('Atlantic/Canary').decode('7/16/2024 21:53:13')
    );
    expect(timestamp.getTime()).toStrictEqual(1721163193000);
  });
});
