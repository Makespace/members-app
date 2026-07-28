import {randomUUID} from 'node:crypto';
import {GenReqId} from 'pino-http';

export const REQUEST_ID_HEADER = 'x-request-id';

export const generateRequestId: GenReqId = (req, res) => {
  const incomingRequestId = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incomingRequestId === 'string' && incomingRequestId.trim() !== ''
      ? incomingRequestId
      : randomUUID();

  res.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
};
