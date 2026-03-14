import { EmailAddress } from "../../types";

export const normaliseEmailAddress = (email: EmailAddress): EmailAddress => {
    const splitPoint = email.lastIndexOf('@');
    if (splitPoint < 0) {
        return email;
    }
    return (email.substring(0, splitPoint) + '@' + email.substring(splitPoint + 1).toLowerCase()) as EmailAddress;
};
