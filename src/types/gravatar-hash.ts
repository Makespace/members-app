import {Newtype, iso} from 'newtype-ts';

export interface GravatarHash
  extends Newtype<{readonly GravatarHash: unique symbol}, string> {}

export const isoGravatarHash = iso<GravatarHash>();
