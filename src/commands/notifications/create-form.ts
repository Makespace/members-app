import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {v4} from 'uuid';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

// The admin page for creating a site notification banner.
type ViewModel = {
  id: string;
  areas: ReadonlyArray<{id: string; name: string}>;
};

const renderForm: Form<ViewModel>['renderForm'] = viewModel =>
  pipe(
    html`
      <div class="stack">
        <h1>Create a notification</h1>
        <p>
          The banner shows at the top of every page for its audience until it
          expires, is revoked, or (if dismissable) each person dismisses it.
        </p>
        <form action="/notifications/create" method="post" class="stack">
          <input type="hidden" name="id" value="${safe(viewModel.id)}" />
          <label class="stack">
            <strong>Title</strong>
            <input type="text" name="title" required maxlength="120" />
          </label>
          <label class="stack">
            <strong>Message</strong>
            <textarea name="message" rows="3"></textarea>
          </label>
          <label class="stack">
            <strong>Type</strong>
            <select name="bannerType" required>
              <option value="action">Action needed (orange)</option>
              <option value="event">Upcoming event (green)</option>
              <option value="info">Information (blue)</option>
            </select>
          </label>
          <label class="stack">
            <strong>Link URL (optional)</strong>
            <input type="url" name="linkUrl" />
          </label>
          <label class="stack">
            <strong>Link label (optional)</strong>
            <input type="text" name="linkLabel" placeholder="Sign up here" />
          </label>
          <label>
            <input type="checkbox" name="dismissable" checked />
            People can dismiss this banner
          </label>
          <label class="stack">
            <strong>Expires at (optional)</strong>
            <input type="datetime-local" name="expiresAt" />
          </label>
          <fieldset class="stack">
            <legend><strong>Audience</strong></legend>
            <label>
              <input type="checkbox" name="targetAllOwners" />
              All owners
            </label>
            <p><small>…or owners of specific areas:</small></p>
            ${joinHtml(
              viewModel.areas.map(
                area => html`
                  <label>
                    <input
                      type="checkbox"
                      name="targetAreaIds"
                      value="${safe(area.id)}"
                    />
                    ${sanitizeString(area.name)}
                  </label>
                `
              )
            )}
          </fieldset>
          <label class="stack">
            <strong>Go-live email (optional, markdown)</strong>
            <textarea
              name="emailMarkdown"
              rows="8"
              placeholder="Leave empty for no email. Markdown supported: [link text](https://example.com), **bold**, lists…"
            ></textarea>
            <small
              >If filled in, everyone in the audience is emailed once, shortly
              after you create the notification.</small
            >
          </label>
          <div class="tt-actions">
            <button type="submit">Create notification</button>
            <a href="/notifications">Cancel</a>
          </div>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Create a notification'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  () =>
  ({readModel}) =>
    TE.right({
      id: v4(),
      areas: [...readModel.area.getAllMinimal()]
        .map(area => ({id: area.id as string, name: area.name}))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });

export const createForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
