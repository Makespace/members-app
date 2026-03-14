import { normaliseEmailAddress } from "../../src/read-models/shared-state/normalise-email-address";
import { EmailAddress } from "../../src/types/email-address";

describe('normaliseEmailAddress', () => {
  const validEmails = [
    ['simple@example.com', 'simple@example.com'],
    ['ALLCAPS@EXAMPLE.COM', 'ALLCAPS@example.com'],
    ['MiXeD@ExAmPlE.cOm', 'MiXeD@example.com'],
    ['user.name+tag@domain.co.uk', 'user.name+tag@domain.co.uk'],
    // Emails with quoted @ in the local part should preserve case in local part
    ['"quoted@local"@example.com', '"quoted@local"@example.com'],
    ['"Quoted@Local"@EXAMPLE.COM', '"Quoted@Local"@example.com'],
  ];

  it.each(validEmails)('normalises valid email %s to %s', (input, expected) => {
    expect(normaliseEmailAddress(input as EmailAddress)).toBe(expected);
  });

  const invalidEmails = [
    ['no-at-sign', 'no-at-sign'],
    ['', ''],
    ['@domain.com', '@domain.com'],
    ['local@', 'local@'],
  ];

  it.each(invalidEmails)('handles invalid email %s gracefully', (input, expected) => {
    expect(normaliseEmailAddress(input as EmailAddress)).toBe(expected);
  });
});
