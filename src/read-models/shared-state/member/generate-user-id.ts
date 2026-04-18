import {v5} from 'uuid';
import { UserId } from '../../../types';

// This namespace was randomly generated.
const memberNumberUserIdNamespace = '0f064671-0ba6-44af-a1b5-26629e9308bc';

// We generate the user ids in a consistent way so that we get deterministic events from member linking.
// This makes things simpler otherwise the user ids would change everytime the app was restarted.
// The intention is that user ids should be opaque identifier strings - do not rely specifically on how they are created.
export const generateUserId = (memberNumber: number): UserId =>
  v5(memberNumber.toString(), memberNumberUserIdNamespace) as UserId;
