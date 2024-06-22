import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';

export const renderOptionalDetail = (o: O.Option<string>) =>
  pipe(
    o,
    O.getOrElse(() => '')
  );
