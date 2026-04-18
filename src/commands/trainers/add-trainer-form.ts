import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {EmailAddress} from '../../types';
import {Form} from '../../types/form';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import * as RA from 'fp-ts/ReadonlyArray';
import {renderMemberNumber} from '../../templates/member-number';
import {UUID} from 'io-ts-types';
import {Equipment} from '../../read-models/shared-state/return-types';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  equipmentTable,
  ownersTable,
  trainersTable,
} from '../../read-models/shared-state/state';
import {eq} from 'drizzle-orm';
import { getMemberCoreByUserId } from '../../read-models/shared-state/member/get';

type ViewModel = {
  areaOwnersThatAreNotTrainers: ReadonlyArray<{
    memberNumber: number;
    primaryEmailAddress: EmailAddress;
  }>;
  equipment: Equipment;
};

const nobodyToAddAsTrainer = pipe(
  html`
    <div class="stack">
      <h1>Add a trainer</h1>
      <p>You can't add any trainers right now.</p>
      <p>
        Either all owners are already trainers or there are no owners for this
        area.
      </p>
    </div>
  `,
  toLoggedInContent(safe('Add Trainer'))
);

const renderForm = (viewModel: ViewModel) => {
  if (viewModel.areaOwnersThatAreNotTrainers.length === 0) {
    return nobodyToAddAsTrainer;
  }

  return pipe(
    viewModel.areaOwnersThatAreNotTrainers,
    RA.map(
      member =>
        html`<tr>
          <td>${sanitizeString(member.primaryEmailAddress)}</td>
          <td>${renderMemberNumber(member.memberNumber)}</td>
          <td>
            <form action="#" method="post">
              <input
                type="hidden"
                name="memberNumber"
                value="${member.memberNumber}"
              />
              <input
                type="hidden"
                name="equipmentId"
                value="${viewModel.equipment.id}"
              />
              <button type="submit">Add</button>
            </form>
          </td>
        </tr>`
    ),
    joinHtml,
    tableRows => html`
      <h1>Add a trainer</h1>
      <div id="wrapper"></div>
      <table id="all-members" data-gridjs>
        <thead>
          <tr>
            <th>E-Mail</th>
            <th>Member Number</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `,
    toLoggedInContent(safe('Add Trainer'))
  );
};

const getEquipmentId = (input: unknown) =>
  pipe(
    input,
    t.strict({equipment: UUID}).decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    E.map(({equipment}) => equipment)
  );

const getPotentialTrainers = (db: SharedReadModel['db'], equipmentId: UUID) => {
  const areaId = db
    .select({value: equipmentTable.areaId})
    .from(equipmentTable)
    .where(eq(equipmentTable.id, equipmentId))
    .get();
  if (areaId === undefined) {
    return E.left(
      failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)()
    );
  }
  const existingTrainers = pipe(
    db
      .select({userId: trainersTable.userId})
      .from(trainersTable)
      .where(eq(trainersTable.equipmentId, equipmentId))
      .all(),
    RA.filterMap(({userId}) => getMemberCoreByUserId(db)(userId)),
    RA.map(member => member.memberNumber)
  );
  const owners = pipe(
    db
      .select({userId: ownersTable.userId})
      .from(ownersTable)
      .where(eq(ownersTable.areaId, areaId.value))
      .all(),
    RA.filterMap(({userId}) => getMemberCoreByUserId(db)(userId)),
    RA.map(member => ({
      primaryEmailAddress: member.primaryEmailAddress,
      memberNumber: member.memberNumber,
    }))
  );
  return pipe(
    owners,
    RA.filter(owner => !existingTrainers.includes(owner.memberNumber)),
    E.right
  );
};

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
      E.bind('equipmentId', () => getEquipmentId(input)),
      E.bind('equipment', ({equipmentId}) => {
        const equipment = readModel.equipment.get(equipmentId);
        if (O.isNone(equipment)) {
          return E.left(
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)()
          );
        }
        return E.right(equipment.value);
      }),
      E.bind('areaOwnersThatAreNotTrainers', ({equipmentId}) =>
        getPotentialTrainers(readModel.db, equipmentId)
      ),
      TE.fromEither
    );

export const addTrainerForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
