import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pageTemplate} from '../../templates';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {User} from '../../types';
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
  membersTable,
  ownersTable,
  trainersTable,
} from '../../read-models/shared-state/state';
import {eq} from 'drizzle-orm';

type ViewModel = {
  user: User;
  areaOwnersThatAreNotTrainers: ReadonlyArray<User>;
  equipment: Equipment;
};

const nobodyToAddAsTrainer = (user: ViewModel['user']) =>
  pipe(
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
    pageTemplate(safe('Add Trainer'), user)
  );

const renderForm = (viewModel: ViewModel) => {
  if (viewModel.areaOwnersThatAreNotTrainers.length === 0) {
    return nobodyToAddAsTrainer(viewModel.user);
  }

  return pipe(
    viewModel.areaOwnersThatAreNotTrainers,
    RA.map(
      member =>
        html`<tr>
          <td>${sanitizeString(member.emailAddress)}</td>
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
    pageTemplate(safe('Add Trainer'), viewModel.user)
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
      .select({memberNumber: trainersTable.memberNumber})
      .from(trainersTable)
      .where(eq(trainersTable.equipmentId, equipmentId))
      .all(),
    RA.map(({memberNumber}) => memberNumber)
  );
  const owners = db
    .select({
      emailAddress: membersTable.emailAddress,
      memberNumber: membersTable.memberNumber,
    })
    .from(ownersTable)
    .innerJoin(
      membersTable,
      eq(ownersTable.memberNumber, membersTable.memberNumber)
    )
    .where(eq(ownersTable.areaId, areaId.value))
    .all();
  return pipe(
    owners,
    RA.filter(owner => !existingTrainers.includes(owner.memberNumber)),
    E.right
  );
};

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, readModel}) =>
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
      E.bind('user', () => E.right(user))
    );

export const addTrainerForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
