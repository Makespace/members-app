import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Query} from '../query';
import {toLoggedInContent, safe} from '../../types/html';
import {
  currentAgreement,
  findAgreementVersion,
} from '../../owner-agreement/versions';
import {render} from './render';

// Read an Owners' Agreement back, whole, at any time: by default the version
// you signed (or the current one if you haven't), or any version by its key
// (?version=2024-original).
export const ownerAgreement: Query = deps => (user, _params, queryParams) => {
  const signed = pipe(
    deps.sharedReadModel.members.getByMemberNumber(user.memberNumber),
    O.chain(member => member.ownerAgreement)
  );
  const version = pipe(
    O.fromNullable(queryParams.version),
    O.chain(findAgreementVersion),
    O.alt(() =>
      pipe(
        signed,
        O.chain(agreement => findAgreementVersion(agreement.version))
      )
    ),
    O.getOrElse(() => currentAgreement)
  );
  return pipe(
    render({version, signed, now: new Date()}),
    toLoggedInContent(safe("The Owners' Agreement")),
    TE.right
  );
};
