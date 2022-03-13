import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from './page-template';

export const landingPage = pipe(
  `
		<h1>Lookup Your Member Number</h1>
		<form action="/send-member-number-by-email" method="post">
			<label for="email">E-Mail: </label>
			<input id="email" type="text" name="email" value="">
			<input type="submit" value="Send Member Number">
		</form>
	`,
  pageTemplate
);
