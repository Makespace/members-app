import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {constructViewModel} from './construct-view-model';
import {Query} from '../query';
import {HttpResponse} from '../../types';

export const trainingStatusCsv: Query = deps => user =>
  pipe(
    user,
    constructViewModel(deps),
    E.map(render),
    E.map(body =>
      HttpResponse.mk.Raw({
        body,
        contentType: 'text/csv',
      })
    ),
    TE.fromEither
  );
