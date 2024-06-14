// import * as t from 'io-ts';
// import {flow, pipe} from 'fp-ts/lib/function';
// import * as TE from 'fp-ts/TaskEither';
// import {failureWithStatus} from '../../../types/failureWithStatus';
// import {StatusCodes} from 'http-status-codes';
// import {render} from './render';
// import * as E from 'fp-ts/Either';
// import {formatValidationErrors} from 'io-ts-reporters';
// import {Query} from '../../query';

// const invalidParams = flow(
//   formatValidationErrors,
//   failureWithStatus('Invalid request parameters', StatusCodes.BAD_REQUEST)
// );

// const queryArgs = t.intersection([
//   t.type({equipment: t.string}),
//   t.type({equipment: t.string, trainingSheetId: t.string}),
// ]);

// export const trainingQuizResults: Query = deps => (user, params) =>
//   pipe(
//     params,
//     queryArgs.decode,
//     E.mapLeft(invalidParams),
//     TE.fromEither,
//     TE.chain(constructViewModel(deps, user)),
//     TE.map(viewModel => ({
//       title: `${viewModel.equipment.name} Training Quiz Results`,
//       body: render(viewModel),
//     }))
//   );
