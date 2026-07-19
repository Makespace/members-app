import * as O from 'fp-ts/Option';
import { EmailAddress } from "../types";
import { html, Html, safe, sanitizeString } from "../types/html";

const mailtoLink = (
    email: EmailAddress,
    subject: O.Option<string>,
    body: O.Option<string>
): Html => {
    const escapedEmail = sanitizeString(email);
    const subjectPart = O.isSome(subject) ? html`subject=${safe(encodeURIComponent(subject.value))}` : html``;
    const bodyPart = O.isSome(body) ? html`body=${safe(encodeURIComponent(body.value))}` : html``;
    const querySeperator = O.isSome(subject) || O.isSome(body) ? html`?` : html``;
    const query = safe([subjectPart, bodyPart].join('&'));
    return html`mailto:${escapedEmail}${querySeperator}${query}"`;
}

export const mailTo = (
    email: EmailAddress,
    subject: O.Option<string>,
    body: O.Option<string>
): Html => html`
    <a href="${mailtoLink(email, subject, body)}">
        ${sanitizeString(email)}
    </a>
`;
