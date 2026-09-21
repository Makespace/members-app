import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

// Checkbox groups post one value as a string and several as an array; accept
// both and normalise to an array. Absent means none checked.
const checkboxList = new t.Type<ReadonlyArray<string>, unknown, unknown>(
  'checkboxList',
  (u): u is ReadonlyArray<string> =>
    Array.isArray(u) && u.every(item => typeof item === 'string'),
  (u, c) => {
    if (u === undefined) {
      return t.success([]);
    }
    if (typeof u === 'string') {
      return t.success([u]);
    }
    if (Array.isArray(u) && u.every(item => typeof item === 'string')) {
      return t.success(u);
    }
    return t.failure(u, c);
  },
  value => value
);

// HTML checkboxes submit 'on' when ticked and nothing when not.
const checkbox = new t.Type<boolean, unknown, unknown>(
  'checkbox',
  (u): u is boolean => typeof u === 'boolean',
  u => t.success(u === 'on' || u === 'true' || u === true),
  value => value
);

// datetime-local submits '' when empty, else 'YYYY-MM-DDTHH:mm'.
const optionalDateTime = new t.Type<Date | null, unknown, unknown>(
  'optionalDateTime',
  (u): u is Date | null => u === null || u instanceof Date,
  (u, c) => {
    if (u === undefined || u === null || u === '') {
      return t.success(null);
    }
    if (typeof u === 'string') {
      const parsed = new Date(u);
      return Number.isFinite(parsed.getTime())
        ? t.success(parsed)
        : t.failure(u, c);
    }
    return t.failure(u, c);
  },
  value => value
);

const optionalTrimmed = new t.Type<string | null, unknown, unknown>(
  'optionalTrimmed',
  (u): u is string | null => u === null || typeof u === 'string',
  (u, c) => {
    if (u === undefined || u === null) {
      return t.success(null);
    }
    if (typeof u !== 'string') {
      return t.failure(u, c);
    }
    const trimmed = u.trim();
    return t.success(trimmed === '' ? null : trimmed);
  },
  value => value
);

const codec = t.strict({
  id: tt.UUID,
  title: tt.NonEmptyString,
  message: t.string,
  bannerType: t.keyof({action: null, event: null, info: null}),
  linkUrl: optionalTrimmed,
  linkLabel: optionalTrimmed,
  dismissable: checkbox,
  expiresAt: optionalDateTime,
  targetAllOwners: checkbox,
  targetAreaIds: checkboxList,
  emailMarkdown: optionalTrimmed,
});

type CreateNotification = t.TypeOf<typeof codec>;

const process: Command<CreateNotification>['process'] = input =>
  TE.right(
    O.some(
      constructEvent('NotificationCreated')({
        ...input.command,
        targetAreaIds: input.command.targetAreaIds.map(id => id as tt.UUID),
      })
    )
  );

export const create: Command<CreateNotification> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
