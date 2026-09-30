import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';
import {constructViewModel} from './construct-view-model';
import {render} from './render';

export const outstandingInvoices: Query = deps => user =>
  pipe(
    constructViewModel(deps, user),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Outstanding invoices')))
  );
