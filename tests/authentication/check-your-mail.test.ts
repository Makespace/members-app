import {faker} from '@faker-js/faker';
import {checkYourMailPage} from '../../src/authentication/check-your-mail';
import {EmailAddress} from '../../src/types';

describe('checkYourMailPage', () => {
  it('shows the normalised email address rather than the submitted one', () => {
    const email = `${faker.string.alphanumeric(10)}@${faker.internet.domainName().toUpperCase()}` as EmailAddress;
    const [localPart, domain] = email.split('@');
    const normalisedEmail = `${localPart}@${domain.toLowerCase()}`;

    const page = checkYourMailPage(email);

    expect(page).toContain(normalisedEmail);
    expect(page).not.toContain(email);
  });
});
