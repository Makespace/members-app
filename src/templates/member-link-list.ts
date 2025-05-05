import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {html, sanitizeString, joinHtml} from '../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {EmailAddress} from '../types';

type Member = {
  memberNumber: number;
  emailAddress: EmailAddress;
  name: O.Option<string>;
};

const renderMember = (member: Member) =>
  O.isSome(member.name)
    ? html`<a href="/member/${member.memberNumber}"
        >${sanitizeString(member.name.value)}<a></a
      ></a>`
    : html`<a href="/member/${member.memberNumber}"
        >${sanitizeString(member.emailAddress)}<a></a
      ></a>`;

export const renderMembersAsList = (members: ReadonlyArray<Member>) =>
  pipe(
    members,
    RA.map(renderMember),
    RA.map(item => html` <li>${item}</li> `),
    joinHtml,
    items => html`
      <ul>
        ${items}
      </ul>
    `
  );
