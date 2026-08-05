import {constantTimeEqual} from '../../src/http/constant-time-equal';

describe('constantTimeEqual', () => {
  it('is true for identical strings', () => {
    expect(constantTimeEqual('Bearer secret-token', 'Bearer secret-token')).toBe(
      true
    );
  });

  it('is false for different same-length strings', () => {
    expect(constantTimeEqual('Bearer aaaaaa', 'Bearer bbbbbb')).toBe(false);
  });

  it('is false for different-length strings (without throwing)', () => {
    expect(constantTimeEqual('short', 'a-much-longer-value')).toBe(false);
  });

  it('is false when one side is empty', () => {
    expect(constantTimeEqual('', 'Bearer secret')).toBe(false);
    expect(constantTimeEqual('Bearer secret', '')).toBe(false);
  });

  it('is true for two empty strings', () => {
    expect(constantTimeEqual('', '')).toBe(true);
  });
});
