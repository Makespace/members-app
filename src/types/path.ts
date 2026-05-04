import * as t from 'io-ts';

class PathType extends t.Type<string> {
  readonly _tag = 'PathType' as const;

  constructor() {
    super(
      'string',
      (m): m is string => typeof m === 'string' && m.startsWith('/'),
      (m, c) => (this.is(m) ? t.success(m) : t.failure(m, c)),
      t.identity
    );
  }
}

export const path = new PathType();
