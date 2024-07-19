

export const registerMemberNumberHelper = () => {
  Handlebars.registerHelper('member_number', memberNumber => {
    // This may not be strictly needed as memberNumber should always be a number but following the approach of escaping everything going to end users.
    const escapedMemberNumber = Handlebars.escapeExpression(
      memberNumber as string
    );
    return new Handlebars.SafeString(
      '<a class=memberNumberLink href=/member/' +
        escapedMemberNumber +
        '/><b>' +
        escapedMemberNumber +
        '</b></a>'
    );
  });
};
