import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from './page-template';
import {EmailAddress} from '../types';

type Params = {
  emailAddress: EmailAddress;
};

export const profilePage = (params: Params) =>
  pipe(
    `
    <h1>Your member profile</h1>
    <dl>
      <dt>Email</dt>
      <dd>${params.emailAddress}</dd>
    </dl>
  `,
    pageTemplate('Member Number Lookup')
  );
