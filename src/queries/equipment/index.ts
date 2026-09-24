import * as t from 'io-ts';
import {flow, pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {constructViewModel} from './construct-view-model';
import {render} from './render';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import {Query} from '../query';
import {UUID} from 'io-ts-types';
import {Dependencies} from '../../dependencies';
import {equipmentSlug} from '../../templates/slug';

const invalidParams = flow(
  formatValidationErrors,
  failureWithStatus('Invalid request parameters', StatusCodes.BAD_REQUEST)
);

// Signs print this page's address for someone to type when their camera will
// not scan the code, so a machine answers to its readable slug
// (/equipment/wood-shop-band-saw) as well as to its uuid. uuids keep working,
// so every link already sent out is unaffected.
const resolveReference =
  (deps: Dependencies) =>
  (reference: string): O.Option<UUID> => {
    if (UUID.is(reference)) {
      return O.some(reference);
    }
    const areaNames = new Map(
      deps.sharedReadModel.area
        .getAllMinimal()
        .map(area => [area.id as string, area.name])
    );
    return pipe(
      deps.sharedReadModel.equipment
        .getAllMinimal()
        .find(
          item =>
            equipmentSlug(
              areaNames.get(item.areaId as string) ?? '',
              item.name
            ) === reference.toLowerCase()
        ),
      O.fromNullable,
      O.map(item => item.id)
    );
  };

export const equipment: Query = deps => (user, params) =>
  pipe(
    params,
    t.strict({equipment: t.string}).decode,
    E.mapLeft(invalidParams),
    E.chain(params =>
      pipe(
        resolveReference(deps)(params.equipment),
        E.fromOption(
          failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)
        )
      )
    ),
    TE.fromEither,
    TE.chain(constructViewModel(deps, user)),
    TE.map(render)
  );
