import {User} from '../../types';
import * as O from 'fp-ts/Option';

export type ViewModel = {
  user: User;
  superUsers: ReadonlyArray<{
    memberNumber: number;
    name: O.Option<string>;
    emailAddress: string;
    superUserSince: Date | null;
  }>;
};
