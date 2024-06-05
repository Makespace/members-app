import {flow} from 'fp-ts/lib/function';
import {apiPost} from './api-post';
import {formGet} from './form-get';
import {formPost} from './form-post';
import asyncHandler from 'express-async-handler';
import {queryGet} from './query-get';

export const http = {
  apiPost: flow(apiPost, asyncHandler),
  formGet: flow(formGet, asyncHandler),
  formPost: flow(formPost, asyncHandler),
  queryGet,
};
