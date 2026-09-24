import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {constructEvent} from '../../types';
import {Command, WithActor} from '../command';
import {isAdminSuperUserOrTrainerOrOwnerForEquipment} from '../authentication-helpers/is-admin-or-super-user-or-owner-trainer';

// A web address, or an empty string to clear the one recorded. Checked here
// because the value is printed on a sign and scanned off a machine: a typo
// found at the form is free, and found on fifty printed posters is not.
const GuideUrl = new t.Type<string, string, unknown>(
  'GuideUrl',
  (input): input is string => typeof input === 'string',
  (input, context) => {
    if (typeof input !== 'string') {
      return t.failure(input, context, 'The guide url must be text');
    }
    const trimmed = input.trim();
    if (trimmed === '') {
      return t.success('');
    }
    try {
      const url = new URL(trimmed);
      return url.protocol === 'http:' || url.protocol === 'https:'
        ? t.success(url.toString())
        : t.failure(input, context, 'The guide url must be http or https');
    } catch {
      return t.failure(input, context, 'That is not a web address');
    }
  },
  t.identity
);

const codec = t.strict({
  equipmentId: tt.UUID,
  guideUrl: GuideUrl,
});

type SetGuideUrl = t.TypeOf<typeof codec>;

const process = (input: {command: WithActor<SetGuideUrl>}) =>
  TE.right(O.some(constructEvent('EquipmentGuideUrlSet')(input.command)));

export const setGuideUrl: Command<SetGuideUrl> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrTrainerOrOwnerForEquipment,
};
