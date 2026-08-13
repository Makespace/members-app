import {createHash, timingSafeEqual} from 'node:crypto';

// Constant-time comparison for authentication secrets (e.g. bearer tokens), so
// response timing can't be used to recover the secret one character at a time.
// Both sides are hashed to a fixed-length digest first, so a length difference
// is also compared in constant time (and timingSafeEqual never throws on
// mismatched-length inputs).
export const constantTimeEqual = (a: string, b: string): boolean =>
  timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest()
  );
