import {RequestHandler} from 'express';

export type Route = {
  path: string;
  method: 'get' | 'post';
  handler: RequestHandler;
};

export const get = (path: string, handler: RequestHandler): Route => ({
  path,
  handler,
  method: 'get',
});

export const post = (path: string, handler: RequestHandler): Route => ({
  path,
  handler,
  method: 'post',
});
