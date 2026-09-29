import * as t from 'io-ts';
import {flow, pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {Html, safe, toLoggedInContent} from '../../types/html';
import {Query} from '../query';
import {resolveEquipmentReference} from '../equipment/resolve-reference';
import {constructViewModel, ViewModel} from './construct-view-model';
import {
  renderFailedQuizzes,
  renderQuizResults,
  renderTrainedUsers,
} from './render';

const invalidParams = flow(
  formatValidationErrors,
  failureWithStatus('Invalid request parameters', StatusCodes.BAD_REQUEST)
);

// The lists that used to sit at the bottom of a machine's page. They are long
// enough to bury everything above them, so each has a page of its own and the
// machine's page links to it with its count.
const peoplePage = (
  title: string,
  render: (viewModel: ViewModel) => Html,
  // The quiz lists say who has attempted what, which is for the people who
  // run the training rather than for everybody.
  trainersOnly: boolean
): Query =>
  deps =>
  (user, params, queryParams) =>
    pipe(
      params,
      t.strict({equipment: t.string}).decode,
      E.mapLeft(invalidParams),
      E.chain(decoded =>
        pipe(
          resolveEquipmentReference(deps)(decoded.equipment),
          E.fromOption(
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)
          )
        )
      ),
      TE.fromEither,
      TE.chain(equipmentId =>
        constructViewModel(deps, user)(
          equipmentId,
          O.fromNullable(queryParams.q)
        )
      ),
      TE.filterOrElse(
        viewModel => !trainersOnly || viewModel.isTrainerOrOwner,
        () =>
          failureWithStatus(
            'Only trainers and owners can see the quiz results',
            StatusCodes.FORBIDDEN
          )()
      ),
      TE.map(render),
      TE.map(toLoggedInContent(safe(title)))
    );

export const equipmentTrainedUsers = peoplePage(
  'Currently trained users',
  renderTrainedUsers,
  false
);

export const equipmentQuizResults = peoplePage(
  'Training quiz results',
  renderQuizResults,
  true
);

export const equipmentFailedQuizzes = peoplePage(
  'Failed quizzes',
  renderFailedQuizzes,
  true
);
