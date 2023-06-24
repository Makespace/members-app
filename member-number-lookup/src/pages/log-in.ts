import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from './page-template';

export const logInPage = pipe(
  `
		<h1>Log in</h1>
		<form action="/auth/callback" method="post">
			<label for="email">E-Mail: </label>
			<input id="email" type="email" required name="email" value="">
			<p>We will email you a magic log in link.</p>
			<input type="submit" value="Email me a link">
		</form>
	`,
  pageTemplate('Member Number Lookup')
);
