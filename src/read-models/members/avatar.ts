import {createHash} from 'crypto';
import {GravatarHash, isoGravatarHash} from '../../types';

export function gravatarHashFromEmail(email: string): GravatarHash {
  const trimmedEmail = email.trim().toLowerCase();
  const hash = createHash('sha256').update(trimmedEmail).digest('hex');
  return isoGravatarHash.wrap(hash);
}
