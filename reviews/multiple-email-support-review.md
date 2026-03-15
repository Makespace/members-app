# MR Review: Multiple Email Support

## Findings

### 1) Case-sensitive uniqueness check can create ambiguous identities (high)

`link-number-to-email` treats emails as case-sensitive when deciding whether an email is already in use (`event.email === command.email`).
At login time, lookup normalises domains (`normaliseEmailAddress`) and then rejects if more than one member is returned.

Impact:
- Two different member numbers can be linked to effectively the same mailbox by varying only domain case.
- Login then fails with "Multiple members associated..." and no login email is sent.
- This is both an availability risk and account-management footgun.

Recommendation:
- Compare normalised addresses in `link-number-to-email` for duplicate/uniqueness checks.
- Add a regression test for linking `user@example.com` and `user@EXAMPLE.COM` on different member numbers.

### 2) Missing test coverage for the new ambiguous-member branch (medium)

`sendLogInLink` has an explicit branch for `members.length > 1`, but current tests do not exercise that branch.

Impact:
- Important behavior (error handling and logging around ambiguous accounts) can regress silently.

Recommendation:
- Add an authentication test that seeds two unlinked accounts resolving to the same normalised email and asserts:
  - `sendEmail` is not called,
  - a `Left` is returned with the expected message,
  - logging occurs (if practical).

### 3) PII in error logs for failed lookup path (low)

The ambiguous-user error logs the submitted email address directly.

Impact:
- Increases PII exposure in logs and can make audit/compliance handling harder.

Recommendation:
- Either redact/hash email before logging, or log only a stable fingerprint/correlation ID.
