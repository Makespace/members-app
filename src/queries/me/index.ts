import * as TE from 'fp-ts/TaskEither';
import {Query} from '../query';
import {HttpResponse} from '../../types';

export const me: Query = () => user =>
  TE.right(
    HttpResponse.mk.Redirect({
      url: `/member/${user.memberNumber}`,
    })
  );
