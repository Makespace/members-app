import * as O from 'fp-ts/Option';
import {TroubleTicketDataTable} from '../../sync-worker/google/sheet-data-table';

export type ViewModel = {
  troubleTicketData: O.Option<TroubleTicketDataTable['rows']>;
};
