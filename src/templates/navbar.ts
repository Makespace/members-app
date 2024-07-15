import Handlebars from 'handlebars';

export const registerNavBar = () => {
  Handlebars.registerPartial(
    'navbar',
    `
      <nav class="page-nav">
        <a href="/"
          ><img
            width="64"
            height="64"
            src="/static/MS-LOGO-txpt-512.png"
            alt="Makespace"
            class="page-nav__logo"
        /></a>
        <a href="/members">Members</a>
        <a href="/equipment">Equipment</a>
        <a href="/areas">Areas</a>
        <a href="/log-out">Log out</a>
        {{loggedInUserSquare user}}
      </nav>
    `
  );
};
