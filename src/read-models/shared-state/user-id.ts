import {v5} from 'uuid';
import {UserId} from '../../types';

const memberNumberUserIdNamespace = 'be1a6ac5-79ec-45c1-944a-cf94f1a18315';

export const userIdFromMemberNumber = (memberNumber: number): UserId =>
  v5(memberNumber.toString(), memberNumberUserIdNamespace) as UserId;
