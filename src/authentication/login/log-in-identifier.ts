import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {EmailAddress, EmailAddressCodec} from '../../types';

// A member logging in knows one of two things about themselves: the address
// they joined with, or the number on their fob. Either is enough to say who
// they are - the link is only ever sent to the address already on file, so
// what they type decides where to look, not where to send.
export type LogInIdentifier =
  | {tag: 'email'; email: EmailAddress}
  | {tag: 'memberNumber'; memberNumber: number};

// Member numbers are small integers; anything else is treated as an address
// so that the error a member sees is about the thing they meant to type.
const looksLikeAMemberNumber = /^[0-9]{1,9}$/;

export const parseLogInIdentifier = (
  body: unknown
): E.Either<string, LogInIdentifier> => {
  const raw =
    typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof (body as {email: unknown}).email === 'string'
      ? (body as {email: string}).email.trim()
      : '';
  if (raw === '') {
    return E.left('Enter your email address or your member number');
  }
  if (looksLikeAMemberNumber.test(raw)) {
    return E.right({tag: 'memberNumber', memberNumber: Number(raw)});
  }
  return pipe(
    raw,
    EmailAddressCodec.decode,
    E.bimap(
      () => "That is not an email address or a member number",
      email => ({tag: 'email' as const, email})
    )
  );
};
