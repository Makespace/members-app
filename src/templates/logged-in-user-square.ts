import Handlebars from 'handlebars';

export const registerLoggedInUserSquare = () => {
  Handlebars.registerPartial(
    'loggedInUserSquare',
    `
        <a href="/me">
            {{avatar_thumbnail this.emailAddress this.memberNumber}}
        </a>
      `
  );
};
