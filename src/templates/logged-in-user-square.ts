export const registerLoggedInUserSquare = () => {
  Handlebars.registerPartial(
    'loggedInUserSquare',
    `
        <a href="/me">
            {{avatar_thumbnail member=loggedInMember}}
        </a>
      `
  );
};
