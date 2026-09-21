import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {Query} from '../query';
import {toLoggedInContent, safe} from '../../types/html';
import {render} from './render';

export const roadmap: Query = () => () =>
  pipe(render(), toLoggedInContent(safe('Roadmap')), TE.right);
