import {Application} from 'express';
import http, {IncomingHttpHeaders} from 'node:http';
import {AddressInfo} from 'node:net';

type Answer = {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

// Runs an express app on a free local port so a test can make real HTTP
// requests: what a display sees includes what express adds on its own, such
// as answering 304 Not Modified.
//
// Requests go out through node:http with exactly the headers given, as a
// display's would. fetch() is no good here: given If-None-Match it adds
// Cache-Control: no-cache, and express rightly never answers 304 to that.
export const serve = async (app: Application) => {
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const {port} = server.address() as AddressInfo;
  return {
    get: (path: string, headers: Record<string, string> = {}) =>
      new Promise<Answer>((resolve, reject) => {
        http
          .get({host: '127.0.0.1', port, path, headers}, response => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () =>
              resolve({
                status: response.statusCode ?? 0,
                headers: response.headers,
                body: Buffer.concat(chunks),
              })
            );
          })
          .on('error', reject);
      }),
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
};
