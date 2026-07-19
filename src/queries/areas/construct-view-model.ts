import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {AreaViewModel, OwnerViewModel, ViewModel} from './view-model';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {
  getRecurlyReasonsForMember,
  RecurlyFlags,
  RecurlyReason,
} from '../../read-models/external-state/recurly-status';
import {Area, Owner} from '../../read-models/shared-state/return-types';
import {StatusCodes} from 'http-status-codes';
import {trainingsByQuarter} from '../../read-models/shared-state/member/training-delivered';
import {DateTime} from 'luxon';
import {UUID} from 'io-ts-types';

const NO_RECURLY_DATA: {
  flags: O.Option<RecurlyFlags>;
  reasons: ReadonlyArray<RecurlyReason>;
} = {flags: O.none, reasons: ['no-data']};

const expandOwner =
  (
    sharedReadModel: Dependencies['sharedReadModel'],
    extDB: ExternalStateDB,
    now: DateTime,
    equipmentIds: ReadonlyArray<UUID>
  ) =>
  async (owner: Owner): Promise<OwnerViewModel> => {
    // Owners don't carry their email list, so resolve the full member for the
    // recurly lookup (which matches on verified emails).
    const member = sharedReadModel.members.getById(owner.userId);
    const {flags, reasons} = O.isSome(member)
      ? await getRecurlyReasonsForMember(extDB)(member.value)
      : NO_RECURLY_DATA;

    // Active-for-ownership is a rule local to this page: a past-due invoice
    // counts as inactive, since cancelling payment is a common way members
    // self-deactivate. The shared 'active'/'inactive' status calc is unchanged.
    const isActiveOwner =
      O.isSome(flags) &&
      flags.value.hasActiveSubscription &&
      !flags.value.hasPastDueInvoice;

    // Scope trainings to this area's equipment only.
    const trainings = trainingsByQuarter(
      sharedReadModel.members.trainingsDeliveredBy(
        owner.memberNumber,
        equipmentIds
      ),
      now
    );

    return {...owner, isActiveOwner, reasons, trainingsByQuarter: trainings};
  };

const expandArea =
  (
    sharedReadModel: Dependencies['sharedReadModel'],
    extDB: ExternalStateDB,
    now: DateTime
  ) =>
  async (area: Area): Promise<AreaViewModel> => {
    const equipmentIds = area.equipment.map(equipment => equipment.id);
    return {
      ...area,
      owners: await Promise.all(
        area.owners.map(expandOwner(sharedReadModel, extDB, now, equipmentIds))
      ),
    };
  };

export const constructViewModel =
  (sharedReadModel: Dependencies['sharedReadModel'], extDB: ExternalStateDB) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
  async () => {
    const member = sharedReadModel.members.getByMemberNumber(user.memberNumber);
    if (O.isNone(member)) {
      return E.left(
        failureWithStatus(
          'Cannot find sufficient information about you to determine if you can access this page',
          StatusCodes.UNAUTHORIZED
        )()
      );
    }

    const isSuperUser = member.value.isSuperUser;
    const isOwnerOfAnyArea = member.value.ownerOf.length > 0;

    const now = DateTime.now();
    return E.right({
      canManageAreas: isSuperUser,
      canSeeOwnerPrivateDetails: isSuperUser || isOwnerOfAnyArea,
      areas: await Promise.all(
        sharedReadModel.area.getAll().map(expandArea(sharedReadModel, extDB, now))
      ),
    });
  };
