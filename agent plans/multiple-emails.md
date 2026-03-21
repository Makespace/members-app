# Multi-Email Member Accounts With Verified Primary Email

## Summary
- Add support for multiple email addresses per member, with one selected `primaryEmailAddress`.
- New emails are always added as `unverified`.
- Only verified emails can be used for login and only verified emails can be selected as primary.
- Users cannot remove emails.
- Existing `MemberNumberLinkedToEmail` history remains valid by projecting it as a verified primary email, so current users continue to work without migration of the event store.

## Key Changes
- **Domain events and invariants**
  - Add `MemberEmailAdded`, `MemberEmailVerificationRequested`, `MemberEmailVerified`, and `MemberPrimaryEmailChanged`.
  - Keep `MemberNumberLinkedToEmail` as a legacy bootstrap event only.
  - Enforce these rules in command processing:
    - email addresses are globally unique across all members, including unverified ones
    - adding an already-linked email is a no-op for the same member and a failure event for a different member
    - `MemberPrimaryEmailChanged` is allowed only when the target email belongs to the member and is verified
    - verification is idempotent
  - Keep self-service commands authorized with the existing self-or-privileged pattern.

- **Read model and types**
  - Replace the single-email assumption in the shared member model with:
    - `primaryEmailAddress: EmailAddress`
    - `emails: ReadonlyArray<MemberEmail>`
  - Introduce a `MemberEmail` shape with `emailAddress`, `verifiedAt: O.Option<Date>`, and `addedAt: Date`.
  - Add a dedicated `memberEmails` table in the shared read model and store `primaryEmailAddress` on `members` for cheap rendering and stable downstream access.
  - Project legacy `MemberNumberLinkedToEmail` into:
    - a `members` row if missing
    - a verified `memberEmails` row
    - `members.primaryEmailAddress`
  - Update member merge behavior so grouped member numbers merge all email rows and expose one primary email for the merged member. Primary selection should come from the highest-priority merged record, matching the current precedence pattern used in `mergeMemberCore`.

- **Authentication and verification flow**
  - Keep `POST /auth` as the login entrypoint.
  - Change login lookup to search verified emails only; unverified emails behave as “no member associated”.
  - Continue sending the login email to the matched verified address, not to the member’s primary email unless they are the same.
  - Extend the session and JWT user payload to include:
    - `memberNumber`
    - `emailAddress` as the authenticated email used for that login
    - `primaryEmailAddress`
  - Add a separate email-verification token flow using a distinct token purpose from magic-link login.
  - Add routes:
    - `GET /auth/verify-email/landing`
    - `GET /auth/verify-email/callback`
    - an invalid-verification-link page or reuse the existing invalid-link pattern with verification-specific copy
  - Verification tokens should carry `memberNumber`, `emailAddress`, purpose, and expiry.
  - Reuse the existing email rate limiter for verification emails.

- **UI and commands**
  - Update the `/me` page to show:
    - primary email prominently
    - a table/list of all email addresses with `Verified` / `Unverified` status
    - an add-email form
    - a `Send verification email` action for unverified emails
    - a `Make primary` action for verified non-primary emails
  - Do not render any remove action.
  - Mirror the multi-email display anywhere a member profile currently shows only `emailAddress`, but use `primaryEmailAddress` where the screen only has room for one canonical address.
  - Add commands/forms under the existing `members` route family:
    - `members/add-email`
    - `members/send-email-verification`
    - `members/change-primary-email`
  - Use `primaryEmailAddress` everywhere the app currently means “default displayed member email”, including Gravatar, member tables, and training/admin views.

- **Compatibility and downstream behavior**
  - Update `sharedReadModel.members.findByEmail` to read from `memberEmails` and return only members with a verified match.
  - Update any code that currently reads `member.emailAddress` to either:
    - `member.primaryEmailAddress` for display/default contact behavior, or
    - `member.emails` when the feature actually needs the full set
  - Update Recurly subscription application so it resolves membership status through verified emails only. It must not activate a member based on an unverified address.
  - Preserve the existing admin “link email + member number” workflow by making it project as an immediately verified primary email for bootstrap/import use.

## Public Interfaces and Types
- `User` gains `primaryEmailAddress` while keeping `emailAddress` as the authenticated email for the current session.
- `MemberCoreInfo` and `Member` replace the single `emailAddress` field with `primaryEmailAddress` plus `emails`.
- `SharedReadModel.members.findByEmail(email)` keeps the same signature but now matches verified emails only.
- New form/command inputs:
  - `AddMemberEmail { memberNumber, email }`
  - `SendMemberEmailVerification { memberNumber, email }`
  - `ChangeMemberPrimaryEmail { memberNumber, email }`

## Test Plan
- **Command tests**
  - add unverified email to a member
  - reject add when email belongs to another member
  - no-op when re-adding same email to same member
  - reject primary change to unverified email
  - allow primary change to verified email
  - verification is idempotent
- **Read-model tests**
  - legacy `MemberNumberLinkedToEmail` produces a verified primary email
  - grouped/rejoined members expose all emails after merge
  - only verified emails are returned by `findByEmail`
  - primary email projection changes correctly after `MemberPrimaryEmailChanged`
- **Authentication tests**
  - login succeeds with any verified email
  - login fails for unverified email
  - login email is sent to the matched verified address
  - verification token expiry and invalid token handling
  - session decoding works with the new `User` shape
- **Query/render tests**
  - `/me` shows primary email and all addresses with status labels
  - unverified rows show verification action only
  - verified non-primary rows show `Make primary`
  - pages that previously rendered `member.emailAddress` now render `member.primaryEmailAddress`

## Assumptions and Defaults
- Email uniqueness is global across all member emails, not just verified emails.
- Users cannot delete emails in v1.
- A member must always have a primary email once they have at least one email.
- Legacy linked emails are treated as verified and primary automatically.
- `primaryEmailAddress` is the canonical display/default-contact email; `emailAddress` on the session user is the email used to authenticate that session.
- Recurly and any other email-based external syncs should trust verified emails only.
