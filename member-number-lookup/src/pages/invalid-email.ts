import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from './page-template';

export const invalidEmailPage = pipe(
  `
		<h1>Whoops...</h1>
		<p>You entered something that isn't a valid email address.</p>
	`,
  pageTemplate
);
