import {parseResponseJson} from '../../src/trouble-tickets/parse-response';

// The exact question-string keys the sync worker uses when caching a submission.
const QUESTION_KEYS = {
  other:
    'If you answered "Other" above or an ABS or PLA 3d printer, please tell us which one. (printers are numbered from the left',
  status: "What's the status of the machine?",
  attempting:
    'What were you attempting to do with the machine? Please include details about material or file type and what you expected to happen.',
  issue:
    'What error or issue did you encounter.  Please include events and observations about what actually happened.',
  steps:
    'What steps did you take before encountering the error.  Please include any relevant settings or changes made prior to the error.',
};

describe('parseResponseJson', () => {
  it('maps the sheet question keys to the compact shape', () => {
    const raw = JSON.stringify({
      [QUESTION_KEYS.other]: 'Printer two',
      [QUESTION_KEYS.status]: 'Working but not configured',
      [QUESTION_KEYS.attempting]: 'Print small model',
      [QUESTION_KEYS.issue]: 'AMS sync stuck',
      [QUESTION_KEYS.steps]: 'Retried connecting',
    });
    expect(parseResponseJson(raw)).toStrictEqual({
      otherEquipmentDetail: 'Printer two',
      status: 'Working but not configured',
      attempting: 'Print small model',
      issue: 'AMS sync stuck',
      steps: 'Retried connecting',
    });
  });

  it('defaults missing answers to empty strings', () => {
    const raw = JSON.stringify({
      [QUESTION_KEYS.status]: 'Broken',
    });
    expect(parseResponseJson(raw)).toStrictEqual({
      otherEquipmentDetail: '',
      status: 'Broken',
      attempting: '',
      issue: '',
      steps: '',
    });
  });

  it('falls back to positional order when keys are unrecognised', () => {
    const raw = JSON.stringify({
      unknownKey0: 'other',
      unknownKey1: 'status',
      unknownKey2: 'attempting',
      unknownKey3: 'issue',
      unknownKey4: 'steps',
    });
    expect(parseResponseJson(raw)).toStrictEqual({
      otherEquipmentDetail: 'other',
      status: 'status',
      attempting: 'attempting',
      issue: 'issue',
      steps: 'steps',
    });
  });

  it('returns all-empty for invalid JSON', () => {
    expect(parseResponseJson('not json')).toStrictEqual({
      otherEquipmentDetail: '',
      status: '',
      attempting: '',
      issue: '',
      steps: '',
    });
  });
});
