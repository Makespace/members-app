import {pipe} from 'fp-ts/lib/function';
import {html, safe} from '../types/html';
import {isolatedPageTemplate} from '../templates/page-template';

export const logInPage = pipe(
  html`
    <div class="container">
      <div class="max-w-md mx-auto">
        <h1 class="mb-6">Log in</h1>
        <form action="/auth" method="post">
          <label for="email">E-Mail: </label>
          <input
            id="email"
            type="email"
            required
            name="email"
            value=""
            class="mb-2"
          />
          <p class="text-sm text-gray mb-6">
            Enter email associated with your MakeSpace membership.
          </p>
          <button type="submit" class="w-full mt-6 mb-6">
            Email me a login link
          </button>
        </form>
      </div>
    </div>
  `,
  isolatedPageTemplate(safe('MakeSpace Members App'))
);
