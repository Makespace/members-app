import {SharedDatabaseDump} from '../../read-models/shared-state/debug/dump';

export type ViewModel = {
  jsonDump: SharedDatabaseDump;
  bufferDump: Buffer;
};
