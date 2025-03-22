import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {constructViewModel} from './construct-view-model';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';

export const domainEvents: Query = _deps => user =>
  pipe(
    user,
    constructViewModel(),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Domain Events')))
  );
