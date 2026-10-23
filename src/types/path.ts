import * as t from 'io-ts';

class PathType extends t.Type<string> {
  readonly _tag = 'PathType' as const;

  constructor() {
    super(
      'string',
      // A path on this site: starts with one slash, so not //host or /\host,
      // which browsers treat as another site.
      (m): m is string => typeof m === 'string' && /^\/(?![/\\])/.test(m),
      (m, c) => (this.is(m) ? t.success(m) : t.failure(m, c)),
      t.identity
    );
  }
}

export const path = new PathType();
