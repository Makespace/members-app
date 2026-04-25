import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {FailureWithStatus} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {SharedReadModel} from '../../read-models/shared-state';
import {mustBeSuperuser} from '../util';
import { getRecurlyStatusForMember } from '../../read-models/external-state/recurly-status';
import { MemberCoreInfo } from '../../read-models/shared-state/return-types';
import { ExternalStateDB } from '../../sync-worker/external-state-db';

const getRecurlyStatus = async (extDB: ExternalStateDB, member: MemberCoreInfo) => ({
  ...member,
  recurlyStatus: await getRecurlyStatusForMember(extDB)(member)
});

const expandRecurlyStatus = (extDB: ExternalStateDB, members: ReadonlyArray<MemberCoreInfo>) => Promise.all(members.map(m => getRecurlyStatus(extDB, m)));

export const constructViewModel =
  (sharedReadModel: SharedReadModel, extDB: ExternalStateDB) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> => async () => {
    const superUserCheck = await mustBeSuperuser(sharedReadModel, user)();
    if (E.isLeft(superUserCheck)) {
      return superUserCheck;
    }
    return E.right({
      members: await expandRecurlyStatus(extDB, sharedReadModel.members.getAllCore())
    });
  }
