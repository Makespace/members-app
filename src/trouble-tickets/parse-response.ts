import {TroubleTicketResponse} from '../types/trouble-ticket';

// The question strings used as JSON keys by the sync worker when it caches a submission
// (see src/sync-worker/sync_trouble_ticket.ts). Listed in the fixed order the worker
// writes them, so we can fall back to positional lookup if the wording ever changes.
const RESPONSE_KEYS: ReadonlyArray<keyof TroubleTicketResponse> = [
  'otherEquipmentDetail',
  'status',
  'attempting',
  'issue',
  'steps',
];

const QUESTION_KEYS: Record<keyof TroubleTicketResponse, string> = {
  otherEquipmentDetail:
    'If you answered "Other" above or an ABS or PLA 3d printer, please tell us which one. (printers are numbered from the left',
  status: "What's the status of the machine?",
  attempting:
    'What were you attempting to do with the machine? Please include details about material or file type and what you expected to happen.',
  issue:
    'What error or issue did you encounter.  Please include events and observations about what actually happened.',
  steps:
    'What steps did you take before encountering the error.  Please include any relevant settings or changes made prior to the error.',
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

// Parses the cached `submitted_response_json` into the compact response shape. When the
// object uses the known question-string keys we read by key and default any missing answer
// to ''. Only if NONE of the known keys are present (e.g. the form wording changed) do we
// fall back to positional order - reading by position on a keyed object would misattribute
// a partial answer set (a lone `status` would leak into `otherEquipmentDetail`).
export const parseResponseJson = (raw: string): TroubleTicketResponse => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const record: Record<string, unknown> =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};

  const hasKnownKeys = RESPONSE_KEYS.some(
    field => QUESTION_KEYS[field] in record
  );

  if (hasKnownKeys) {
    return {
      otherEquipmentDetail: asString(record[QUESTION_KEYS.otherEquipmentDetail]),
      status: asString(record[QUESTION_KEYS.status]),
      attempting: asString(record[QUESTION_KEYS.attempting]),
      issue: asString(record[QUESTION_KEYS.issue]),
      steps: asString(record[QUESTION_KEYS.steps]),
    };
  }

  const values = Object.values(record);
  return {
    otherEquipmentDetail: asString(values[0]),
    status: asString(values[1]),
    attempting: asString(values[2]),
    issue: asString(values[3]),
    steps: asString(values[4]),
  };
};
