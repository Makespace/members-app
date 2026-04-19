import {Client} from '@libsql/client';
import {drizzle} from 'drizzle-orm/libsql';
import {
  sheetDataTable,
  sheetSyncMetadataTable,
  troubleTicketDataTable,
} from './sheet-data-table';

const googleDBSchema = {
  sheetDataTable,
  sheetSyncMetadataTable,
  troubleTicketDataTable,
};

export const initGoogleDB = (client: Client) =>
  drizzle(client, {schema: googleDBSchema});

export type GoogleDB = ReturnType<typeof initGoogleDB>;
