import {SafeString} from 'handlebars';

const OOPS_PAGE_TEMPLATE = Handlebars.compile(
  `
  <h1>Sorry, we have encountered a problem</h1>
  <p>{{message}}</p>
  <p>
    Please try again. If the problem persists please reach out in the google
    group.
  </p>
  `
);

export const oopsPage = (message: string | SafeString) =>
  OOPS_PAGE_TEMPLATE({message});
