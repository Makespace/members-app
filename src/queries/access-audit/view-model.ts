import {AuditGroups} from './classify';

export type ViewModel = {
  groups: AuditGroups;
  totalMembers: number;
  // How many members have any fob recorded: until the Paxton import has
  // been run, "no fob" means "not imported yet" rather than "has no fob".
  membersWithFobs: number;
  thresholds: {removeAccessAfterDays: number; cancelAfterDays: number};
};
