import {DateTime} from 'luxon';
import * as O from 'fp-ts/Option';

export type ViewModel = {
  isSuperUser: boolean;
  troubleTicketData: ReadonlyArray<{
    responseSubmitted: DateTime;
    emailAddress: O.Option<string>;
    whichEquipment: O.Option<string>;
    submitterName: O.Option<string>;
    submitterMembershipNumber: O.Option<number>;
    submittedResponse: Record<string, string>;
  }>;
};
