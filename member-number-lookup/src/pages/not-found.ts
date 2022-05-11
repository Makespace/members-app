import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from './page-template';

export const notFoundPage = pipe(
  `
		<h1>Sorry, can't find that page</h1>
		Please check the address you requested.
	`,
  pageTemplate
);
