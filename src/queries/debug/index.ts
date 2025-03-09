import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {renderBuffer, renderJson} from './render';
import {constructViewModel} from './construct-view-model';
import {Query} from '../query';
import {HttpResponse} from '../../types';

// https://github.com/Makespace/members-app/issues/108
export const dumpSharedDbAsJson: Query = deps => user =>
  pipe(
    user,
    constructViewModel(deps.sharedReadModel),
    TE.map(renderJson),
    TE.map(body =>
      HttpResponse.Raw({
        body,
        contentType: 'application/json',
      })
    )
  );

export const dumpSharedDbAsBuffer: Query = deps => user =>
  pipe(
    user,
    constructViewModel(deps.sharedReadModel),
    TE.map(renderBuffer),
    TE.map(body =>
      HttpResponse.Raw({
        body,
        contentType: 'application/octet-stream',
      })
    )
  );
