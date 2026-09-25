import {faker} from '@faker-js/faker';
import {checkYourMailPage} from '../../src/authentication/login/check-your-mail';
import {EmailAddress} from '../../src/types';

describe('checkYourMailPage', () => {
  // Naming the address on file would turn the login form into a way of
  // looking up any member's email address by guessing at numbers.
  it('never names an address when asked by member number', () => {
    const page = checkYourMailPage({tag: 'memberNumber', memberNumber: 1234});

    expect(page).toContain('1234');
    expect(page).not.toContain('@');
  });

  it('shows the normalised email address rather than the submitted one', () => {
    const email = `${faker.string.alphanumeric(10)}@${faker.internet.domainName().toUpperCase()}` as EmailAddress;
    const [localPart, domain] = email.split('@');
    const normalisedEmail = `${localPart}@${domain.toLowerCase()}`;

    const page = checkYourMailPage({tag: 'email', email});

    expect(page).toContain(normalisedEmail);
    expect(page).not.toContain(email);
  });
});
