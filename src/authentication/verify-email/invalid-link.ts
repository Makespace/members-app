import {Request, Response} from 'express';
import {oopsPage} from '../../templates';
import {StatusCodes} from 'http-status-codes';
import {
  html,
  CompleteHtmlDocument,
} from '../../types/html';


export const invalidLink = (req: Request, res: Response<CompleteHtmlDocument>) => {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send(
        oopsPage(
          html`The link you have used is (no longer) valid. Go back to your
            <a href=/me>homepage</a>.`
        )
      );
  };
