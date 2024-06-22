import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {html} from '../types/html';

export const renderOptionalDetail = (o: O.Option<string>) =>
  pipe(
    o,
    O.getOrElse(() => html`—`)
  );
