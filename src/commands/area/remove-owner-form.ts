/* eslint-disable unused-imports/no-unused-vars */
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {User} from '../../types';
import {Form} from '../../types/form';
import {pipe} from 'fp-ts/lib/function';
import {html, safe, sanitizeString} from '../../types/html';
import {eq} from 'drizzle-orm';
import {StatusCodes} from 'http-status-codes';
import {SharedReadModel} from '../../read-models/shared-state';
import {areasTable} from '../../read-models/shared-state/state';
import {failureWithStatus} from '../../types/failure-with-status';

type ViewModel = {
  user: User;
  areaId: string;
  areaName: string;
  ownerName: string;
  ownerMemberNumber: number;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    () => html`
      <div class="stack-large">
        <h1>Remove owner?</h1>
        <p>
          This will remove <b>${sanitizeString(viewModel.ownerName)}</b> from
          the owners of the <b>${sanitizeString(viewModel.areaName)}</b> area.
        </p>
        <p>
          They will also no longer be a trainer for any of the red equipment in
          the area.
        </p>
        <form action="#" method="post">
          <input
            type="hidden"
            name="areaId"
            value="${safe(viewModel.areaId)}"
          />
          <input
            type="hidden"
            name="memberNumber"
            value="${viewModel.ownerMemberNumber}"
          />
          <button type="submit">Confirm and send</button>
        </form>
      </div>
    `,
    pageTemplate(safe('Remove Owner'), viewModel.user)
  );

const getAreaName = (db: SharedReadModel['db'], areaId: string) =>
  pipe(
    db
      .select({areaName: areasTable.name})
      .from(areasTable)
      .where(eq(areasTable.id, areaId))
      .get(),
    result => result?.areaName,
    E.fromNullable(
      failureWithStatus(
        'The requested area does not exist',
        StatusCodes.NOT_FOUND
      )()
    )
  );

export const removeOwnerForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({user, readModel}) =>
      E.left(
        failureWithStatus('not implemented', StatusCodes.NOT_IMPLEMENTED)()
      ),
};
