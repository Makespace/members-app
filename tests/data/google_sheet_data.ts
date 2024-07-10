import {readFileSync} from 'node:fs';

import {sheets_v4} from 'googleapis/build/src/apis/sheets/v4';

export const EMPTY = {
  data: JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_empty.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
};
export const METAL_LATHE = {
  data: JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_metal_lathe.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  // Manually parsed data for testing:
  email: 'test@makespace.com',
  memberNumber: 1234,
  score: 13,
  maxScore: 14,
  percentage: 93,
  fullMarks: false,
  timestampEpochS: 1705770960,
  quizAnswers: {
    Email: 'test@makespace.com',
    'How many oil level check glasses are there on the Makespace metal lathe?':
      '3',
    'Membership number': '1234',
    Name: 'Test User',
    Score: '13 / 14',
    'The emergency brake is used:':
      'to stop the lathe if a potential or serious situation develops',
    'The end of the lathe that holds the gearboxes and chuck is called':
      'Head stock',
    'The lower gearbox is used to drive': 'the thread drive, the power drive',
    'The part of the lathe that moves along the bed is called': 'Carriage',
    'The tail stock is mainly used for:': 'Drilling and stabilising your work',
    Timestamp: '20/01/2024 17:16:00',
    'What are the 3 positions that the power-drive lever can be set to?':
      'Safe, carriage drive, cross-slide drive',
    'What are the 6 absolute No Nos whilst using the lathe?':
      'your job coming loose, reversing the tail-stock shaft out past the zero mark, hitting the dead stop under power drive, leaving the key in the chuck, your chuck coming loose, allowing your tool to hit the chuck',
    'What are the TWO main cuts you can do on a lathe?':
      'Long cut or end cut, Turn or cross cut',
    'What do you need to check to ensure that the chuck is on correctly and safe to use?':
      "All three of the cam-lock arrows are between their 'V' marks",
    'What is the most common accident on lathes?':
      'The cutting tool colliding with the chuck',
    'When do you need to use the buddy system when using the lathe?':
      'When you are alone in the secure workshop',
    'When is the lathe completely safe to put your hands into whilst powered?':
      'When the yellow safety cover is fully up',
    'Why should you never drive the tail stock beyond the zero position whilst the lathe is running?':
      'It will eject the tool it is holding',
  },
};
export const NOT_FOUND_ERROR = {
  errors: [
    {
      message: 'Requested entity was not found.',
      domain: 'global',
      reason: 'notFound',
    },
  ],
  code: '404',
};
export const TRAINING_SHEETS = {
  [EMPTY.data.spreadsheetId!]: EMPTY,
  [METAL_LATHE.data.spreadsheetId!]: METAL_LATHE,
};
