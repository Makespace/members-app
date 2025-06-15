import {TroubleTicketDataTable} from '../../sync-worker/google/sheet-data-table';

export type ViewModel = {
  troubleTicketData: TroubleTicketDataTable['rows'];
};
