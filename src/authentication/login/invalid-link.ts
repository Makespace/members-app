import {Request, Response} from 'express';
import {oopsPage} from '../../templates';
import {StatusCodes} from 'http-status-codes';
import {
  html,
  HtmlSubstitution,
  CompleteHtmlDocument,
} from '../../types/html';


export const invalidLink =
  (logInPath: HtmlSubstitution) =>
  (req: Request, res: Response<CompleteHtmlDocument>) => {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send(
        oopsPage(
          html`The link you have used is (no longer) valid. Go back to the
            <a href=${logInPath}>log in</a> page.`
        )
      );
  };
