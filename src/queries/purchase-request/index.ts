import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {Query} from '../query';
import {safe, toLoggedInContentWithBackLink} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {render} from './render';
import {canDecide} from '../../purchasing/permissions';
import {liftActorOrUser} from '../../read-models/lift-actor-or-user';

// One purchase request as submitted, with the outcome the server worked out.
// This is where a member lands after submitting one.
// `?sent=1` (added by the form) shows it as the confirmation of a request
// just sent.
export const purchaseRequest: Query = deps => (user, params, queryParams) =>
  pipe(
    params.id,
    UUID.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(
      failureWithStatus('Invalid purchase request', StatusCodes.BAD_REQUEST)
    ),
    E.chain(id =>
      pipe(
        deps.sharedReadModel.purchasing.getRequest(id),
        E.fromOption(() =>
          failureWithStatus('No such purchase request', StatusCodes.NOT_FOUND)()
        )
      )
    ),
    E.map(request => {
      const purchasingArea = pipe(
        deps.sharedReadModel.purchasing.get(
          request.purchasingAreaId,
          request.submittedAt
        ),
        O.map(({id, name}) => ({id, name}))
      );
      return toLoggedInContentWithBackLink(
        safe('Purchase request'),
        pipe(
          purchasingArea,
          O.match(
            () => ({href: '/purchasing-areas', label: 'Purchasing areas'}),
            ({id, name}) => ({href: `/purchasing-areas/${id}`, label: name})
          )
        )
      )(
        render({
          justSent: queryParams.sent === '1',
          request,
          purchasingArea,
          submitterName: pipe(
            deps.sharedReadModel.members.getByMemberNumber(
              request.submittedByMemberNumber
            ),
            O.chain(member => member.name)
          ),
          deciderName: pipe(
            request.decidedByMemberNumber,
            O.chain(deps.sharedReadModel.members.getByMemberNumber),
            O.chain(member => member.name)
          ),
          canDecide: canDecide(
            deps.sharedReadModel,
            liftActorOrUser(user),
            request
          ),
        })
      );
    }),
    TE.fromEither
  );
