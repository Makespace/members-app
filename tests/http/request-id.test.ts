import {IncomingMessage, ServerResponse} from 'node:http';
import {generateRequestId, REQUEST_ID_HEADER} from '../../src/http/request-id';

const makeRequest = (requestId?: string): IncomingMessage =>
  ({
    headers: requestId === undefined ? {} : {[REQUEST_ID_HEADER]: requestId},
  }) as IncomingMessage;

const makeResponse = () =>
  ({setHeader: jest.fn()}) as unknown as ServerResponse;

describe('generateRequestId', () => {
  it('preserves an incoming request ID and returns it in the response', () => {
    const requestId = 'upstream-request-id';
    const response = makeResponse();

    const result = generateRequestId(makeRequest(requestId), response);

    expect(result).toStrictEqual(requestId);
    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, requestId);
  });

  it('generates an ID when the request does not contain one', () => {
    const response = makeResponse();

    const result = generateRequestId(makeRequest(), response);

    expect(result).toEqual(expect.any(String));
    expect(result).not.toStrictEqual('');
    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, result);
  });

  it('generates an ID when the incoming header is empty', () => {
    const response = makeResponse();

    const result = generateRequestId(makeRequest('  '), response);

    expect(result).toEqual(expect.any(String));
    expect(result).not.toStrictEqual('  ');
    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, result);
  });
});
