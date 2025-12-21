import {Newtype, iso} from 'newtype-ts';

export type GravatarHash = Newtype<{readonly GravatarHash: unique symbol}, string>;

export const isoGravatarHash = iso<GravatarHash>();
