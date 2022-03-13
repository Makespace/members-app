import * as TE from 'fp-ts/TaskEither';
import {Email} from '../types';

type GetMemberNumber = (email: Email) => TE.TaskEither<string, number>;

export const getMemberNumber = (): GetMemberNumber => () =>
  TE.left('getMemberNumber not implemented');
