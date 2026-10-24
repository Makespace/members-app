import {assign} from './assign';
import {assignForm} from './assign-form';
import {unassign} from './unassign';
import {unassignForm} from './unassign-form';

export const einkDisplays = {
  assign: {
    ...assign,
    ...assignForm,
  },
  unassign: {
    ...unassign,
    ...unassignForm,
  },
};
