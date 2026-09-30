import {MemberBilling} from '../../read-models/external-state/recurly-billing';

export type ViewModel = {
  memberNumber: number;
  memberName: string;
  billing: MemberBilling;
};
