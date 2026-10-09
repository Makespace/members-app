import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {eq, or} from 'drizzle-orm';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {
  html,
  safe,
  sanitizeOption,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {EmailAddress, EmailAddressCodec, User} from '../../types';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';
import {renderMemberNumber} from '../../templates/member-number';
import {recurlyAccountCodeTable} from '../../sync-worker/recurly/recurly-data-table';
import {ExternalStateDB} from '../../sync-worker/external-state-db';

type ViewModel = {
  user: User;
  memberNumber: number;
  memberName: O.Option<string>;
  email: EmailAddress;
  // The holder's name on the Recurly account, so a wrong member number is
  // visible before anything is linked.
  recurlyName: O.Option<string>;
};

// The one page that stands between an admin and a verified address: it
// puts the member's name and Recurly's name for the account side by side.
const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Link a Recurly address to a member</h1>
      <table>
        <tbody>
          <tr>
            <th scope="row">Member</th>
            <td>${renderMemberNumber(viewModel.memberNumber)} ${sanitizeOption(viewModel.memberName)}</td>
          </tr>
          <tr>
            <th scope="row">Address in Recurly</th>
            <td>${sanitizeString(viewModel.email)}</td>
          </tr>
          <tr>
            <th scope="row">Name on the Recurly account</th>
            <td>${sanitizeOption(viewModel.recurlyName)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Linking records the address as verified for this member without
        them clicking anything, on the strength of the billing record. They
        will be able to log in with it. Check the two names agree.
      </p>
      <form action="?next=/unlinked-recurly" method="post">
        <input type="hidden" name="memberNumber" value="${viewModel.memberNumber}" />
        <input type="hidden" name="email" value="${sanitizeString(viewModel.email)}" />
        <button type="submit">Link as verified</button>
      </form>
    `,
    toLoggedInContentWithBackLink(safe('Link a Recurly address'), {
      href: '/unlinked-recurly',
      label: 'Unlinked Recurly accounts',
    })
  );

const paramsCodec = t.strict({
  member: tt.NumberFromString,
  email: EmailAddressCodec,
});

const recurlyNameFor =
  (extDB: ExternalStateDB) =>
  async (email: string): Promise<O.Option<string>> => {
    const lowered = email.toLowerCase();
    const rows = await extDB
      .select({name: recurlyAccountCodeTable.name})
      .from(recurlyAccountCodeTable)
      .where(
        or(
          eq(recurlyAccountCodeTable.email, lowered),
          eq(recurlyAccountCodeTable.code, lowered)
        )
      )
      .all();
    return O.fromNullable(rows.map(row => row.name).find(name => name !== null) ?? null);
  };

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, readModel, deps}) =>
    pipe(
      input,
      paramsCodec.decode,
      E.mapLeft(
        flow(
          formatValidationErrors,
          failureWithStatus(
            'Parameters submitted to the form were invalid',
            StatusCodes.BAD_REQUEST
          )
        )
      ),
      TE.fromEither,
      TE.chain(params =>
        pipe(
          readModel.members.getByMemberNumber(params.member),
          TE.fromOption(
            failureWithStatus('The requested member does not exist', StatusCodes.NOT_FOUND)
          ),
          TE.chain(member =>
            TE.tryCatch(
              async () => ({
                user,
                memberNumber: member.memberNumber,
                memberName: member.name,
                email: params.email,
                recurlyName: await recurlyNameFor(deps.extDB)(params.email),
              }),
              () =>
                failureWithStatus('Could not read Recurly data', StatusCodes.INTERNAL_SERVER_ERROR)()
            )
          )
        )
      )
    );

// The page shows what Recurly knows about an address, which is for super
// users only, as the POST and /unlinked-recurly are.
export const linkRecurlyEmailForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
